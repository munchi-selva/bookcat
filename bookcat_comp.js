//
// Miscellaneous components used to display the book catalogue
//

// Custom date input change event properties
const DATE_CHANGE_EVENT_TYPE            = "change";
const EVENT_BUBBLE_OPTION               = "bubbles";

// Date filter model property names
const DATE_FILTER_MODEL_TYPE        = "type";
const DATE_FILTER_MODEL_START_DATE  = "start_date";
const DATE_FILTER_MODEL_END_DATE    = "end_date";

// An enumeration representing date filter type identifiers
const FilterTypeEnum =
{
    "FT_ON":        0,
    "FT_BEFORE":    1,
    "FT_AFTER":     2,
    "FT_NOT":       3,
    "FT_BETWEEN":   4,
    "FT_UNKNOWN":   5
};
Object.freeze(FilterTypeEnum);

// Non-printable character codes
const NPC_CR = 13;


// Macro-ish function that converts the input parameter to a CSS class selector
function CLASS_SELECTOR(className)
{
    return "." + className;
}

// Dumps data about an event target
function showEventOrigins(event)
{
    let eventPath = event.composedPath();
    for (let idx = 0; idx < eventPath.length; idx++)
    {
        let elem = eventPath[idx];
        let elemString = "<" + elem.localName + ">";
        let classString = "";
        if (elem.classList)
        {
            for (let classIdx = 0; classIdx < elem.classList.length; classIdx++)
            {
                if (classIdx != 0)
                {
                    classString += "; ";
                }
                classString += elem.classList[classIdx];
            }
        }
        classString = "[classes: " + classString + "]";

        console.log("\t\t[" + idx + "]: " + elemString + " " + classString);

    }
}



//
// A custom date control comprising:
//  * A text input for manual input of dates
//  * A clickable element that launches a date picker
// The text field and date picker are synched.
// Dates have the format yyyy-mm-dd.
// Incomplete dates (yyyy, yyyy-mm) are supported.
//
function getDateControl()
{
    // CSS classes specific to this component
    const CLASS_DATE_INPUT_WRAPPER  = "date-input-wrapper";
    const CLASS_DATE_INPUT          = "date-input";
    const CLASS_HIDDEN_DATE_INPUT   = "hidden-date-input";
    const CLASS_DATE_LAUNCHER       = "date-launcher";
    const DATE_LAUNCHER_TEXT        = "&#x1F4C5";           // Unicode calendar character

    function DateControl()
    {
        this.init();
    }

    //
    // Sets up the control's HTML markup and associated logic.
    // The size of the date launcher is restricted so that it never uses more
    // space than is necessary to display the calendar character.
    // The markup looks something like this:
    // <div class="date-input-wrapper">
    //     <div class="grid-container" style="grid-template-columns: minmax(90%, 100%) 0% minmax(min-content, max-content)">
    //         <input type="text" class="date-input">
    //         <input type="text" class="hidden-date-input">
    //         <div class="date-launcher"></div>
    //     </div>
    // </div>
    //
    DateControl.prototype.init = function()
    {
        // Root element: as a member variable and a local reference
        let controlGrid = this.root = document.createElement("div");
        controlGrid.classList.add(CLASS_DATE_INPUT_WRAPPER);

        // Set up the manual date input, hidden date input & launcher button
        let dateInput = this.dateInput = document.createElement("input");
        dateInput.classList.add(CLASS_DATE_INPUT);

        let hiddenDateInput = document.createElement("input");
        hiddenDateInput.classList.add(CLASS_HIDDEN_DATE_INPUT);

        let dateLauncher = document.createElement("div");
        dateLauncher.classList.add(CLASS_DATE_LAUNCHER);
        dateLauncher.innerHTML = DATE_LAUNCHER_TEXT;

        controlGrid.appendChild(dateInput);
        controlGrid.appendChild(hiddenDateInput);
        controlGrid.appendChild(dateLauncher);

        // Attach the event handlers, etc.
        this.setupGuiHooks();
    }

    DateControl.prototype.setupGuiHooks = function()
    {
        let dateControl = this;

        // Get access to the miscellaneous elements of the control
        let hiddenDateInput = this.root.querySelector(CLASS_SELECTOR(CLASS_HIDDEN_DATE_INPUT));
        let dateLauncher    = this.root.querySelector(CLASS_SELECTOR(CLASS_DATE_LAUNCHER));

        // Set up a change event handler on the visible date input
        this.dateInput.addEventListener(DATE_CHANGE_EVENT_TYPE, this.onDateInputChanged.bind(this));

        // Set up the date picker, attaching it to the hidden input.
        // When a date is picked, notify the visible date input, but ensure the
        // change event handler won't update the date picker
        // (i.e. avoid a recursive loop of events).
        let datePicker = flatpickr(hiddenDateInput,
                                   {
                                        dateFormat:  "Y-m-d",
                                        onChange: this.onDatePicked.bind(this)
                                    });

        // ag-grid specific: ensure that clicking within the date picking
        // widget is interpreted as a selection within the control
        datePicker.calendarContainer.classList.add("ag-custom-component-popup");

        // Set up the launcher button to launch the date picker
        dateLauncher.addEventListener("click", function() { datePicker.open(); });
    }

    DateControl.prototype.getGui = function()
    {
        return this.root;
    };

    //
    // Synchs the manual date input and date picker
    //
    DateControl.prototype.onDateInputChanged = function(event)
    {
        let target              = event.target;
        let dateStr             = target.value;
        let dateComponents      = parseDateComponents(dateStr);

        // Temporary validation code
        if (dateStr && !dateComponents)
        {
            target.classList.add("cat-invalid-data");
        }
        else
        {
            target.classList.remove("cat-invalid-data");
        }

        //
        // Update the date picker, suppressing raising of further change events.
        // Use setDate() for a fully specified date (including null/empty date),
        // jumpDate() otherwise.
        //
        let fullySpecifiedDate = (!dateStr) ||
                                 (dateComponents
                                  &&
                                  (
                                      dateComponents[CAT_FLD_DATE_YEAR] &&
                                      dateComponents[CAT_FLD_DATE_MONTH] &&
                                      dateComponents[CAT_FLD_DATE_DAY]
                                  )
                                 );
        let datePicker = target.nextSibling._flatpickr;

        if (fullySpecifiedDate)
        {
            datePicker.setDate(dateStr, false);
        }
        else
        {
            datePicker.jumpToDate(dateStr, false);
        }
    }

    //
    // Processes a date update by:
    // 1. Setting the manual date input (if a date string is provided)
    // 2. [OPTIONAL] Raising a change event on the manual date input
    //    The final parameter controls bubbling (propagation) of this event
    //
    DateControl.prototype.processDateUpdate = function(dateStr, raiseEvent, bubbleEvent = true)
    {
        if (dateStr != null)
        {
            this.dateInput.value = dateStr;
        }

        if (raiseEvent)
        {
            let changeEventDetails = {};
            changeEventDetails[EVENT_BUBBLE_OPTION] = bubbleEvent;
            let changeEvent = new Event(DATE_CHANGE_EVENT_TYPE, changeEventDetails);

            this.dateInput.dispatchEvent(changeEvent);
        }
    }

    //
    // Handles selection of a date in the picker selection by
    // updating the manual date input, without forcing raising of another event
    //
    DateControl.prototype.onDatePicked = function(selectedDates, dateStr, instance)
    {
        this.processDateUpdate(dateStr, false);
    }

    //
    // Ensures the manual date input and date picker are synched
    //
    DateControl.prototype.synchGUI = function()
    {
        this.processDateUpdate(null, true);
    }

    //
    // Retrieves the date of the control
    //
    DateControl.prototype.getDate = function()
    {
        return this.dateInput.value;
    }

    //
    // Sets the date of the control, optionally propagating any change events
    //
    DateControl.prototype.setDate = function(dateStr, bubble = true)
    {
        this.processDateUpdate(dateStr, true, bubble);
    }

    return new DateControl();
}


//
// Uses the custom date control to provide a cell editor for date fields
// (implements ICellEditorComp)
//
function getDateComponent()
{
    function DateComp() {}

    //
    // [ICellEditorComp]: init?(params: ICellEditorParams): void
    //      Gets called once after the editor is created
    //
    DateComp.prototype.init = function(params)
    {
        // Cache the editor parameters
        this.editorParams = params;

        // Set up the date control and set this up as the editor's root
        this.dateControl = getDateControl();
        this.root = this.dateControl.root;
    };

    //
    // [ICellEditorComp]: afterGuiAttached?(): void
    //      Gets called once after GUI is attached to DOM.
    //
    // Focuses on the date input so that editing can be done.
    // To be consistent with other ag-grid editors, if editing was launched by
    // pressing Enter, the existing date should be selected.
    //
    DateComp.prototype.afterGuiAttached = function()
    {
        this.dateControl.dateInput.focus();

        if (this.editorParams.keyPress == NPC_CR)
        {
            this.dateControl.dateInput.select();
        }
    };

    //
    // [ICellEditorComp]: getGui(): HTMLElement
    //      Returns the DOM element of the editor: what the grid puts into the DOM
    //
    DateComp.prototype.getGui = function()
    {
        return this.root;
    };

    //
    // [ICellEditorComp]: getValue(): any
    //      Returns the final value to the grid, the result of editing
    //
    DateComp.prototype.getValue = function()
    {
        return this.dateControl.getDate();
    }

    //
    // [ICellEditorComp]: destroy?(): void
    //      Gets called once by grid after editing is finished;
    //      any cleanup should be done here
    //
    DateComp.prototype.destroy = function()
    {
        // Nothing to do
    };

    //
    // [ICellEditorComp]: isPopup?(): boolean;
    //      Gets called once after initialised.
    //      If you return true, the editor will appear in a popup
    //
    // Using a popup ensures the entire editor is visible during editing
    //
    DateComp.prototype.isPopup = function()
    {
        return true;
    }

    //
    // [ICellEditorComp]: getPopupPosition?(): string;
    //      Gets called once, only if isPopup() returns true.
    //      Return "over" (default) if the popup should cover the cell, or
    //      "under" if it should be positioned below leaving the cell value visible.
    //
    DateComp.prototype.getPopupPosition = function()
    {
        return "under";
    }

    //
    // [ICellEditorComp]: isCancelBeforeStart?(): boolean;
    //      Gets called once before editing starts, to give editor a chance to
    //      cancel the editing before it even starts.
    //
    // Abort editing if a non-numerical character was entered.
    // Otherwise initialise the date appropriately.
    //
    DateComp.prototype.isCancelBeforeStart = function()
    {
        let initialDate = this.editorParams.formatValue(this.editorParams.value);
        let initialCharString = this.editorParams.charPress;
        if (initialCharString)
        {
            if (isNaN(initialCharString))
            {
                return true;
            }
            else
            {
                initialDate = initialCharString;
            }
        }

        this.dateControl.setDate(initialDate);
        return false;
    }

    //
    // [ICellEditorComp]: isCancelAfterEnd?(): boolean;
    //      Gets called once when editing is finished (e.g. if enter is pressed).
    //      If you return true, then the result of the edit will be ignored.
    //
    // Cancel the edit if the string entered isn't a date string.
    //
    DateComp.prototype.isCancelAfterEnd = function()
    {
        return (!isDateString(this.dateControl.getDate()));
    }

    //
    // Other ICellEditorComp optional methods (not implemented)
    //
    // focusIn?(): boolean;
    //      If doing full row edit, then gets called when tabbing into the cell.
    //
    // focusOut?(): boolean;
    //      If doing full row edit, then gets called when tabbing out of the cell.
    //

    return DateComp;
}


//
// Custom date filter component that presents:
//  * A dropdown providing various filter types, e.g. on/in, after, etc.
//  * Two custom date controls that represent the start/end dates of the filter
// (implements IFilterComp)
//
function getDateFilterComponent()
{
    // CSS classes specific to this component
    const CLASS_DATE_FILTER     = "date-filter";
    const CLASS_FILTER_CHILD    = "filter-child";
    const CLASS_FILTER_DROPDOWN = "filter-dropdown";
    const CLASS_START_DATE      = "start-date";
    const CLASS_END_DATE        = "end-date";
    const CLASS_FILTER_DIVIDER  = "filter-divider";
    const CLASS_BUTTON_PANE     = "filter-button-pane";
    const CLASS_BUTTON_CLEAR    = "btn-clear-filter";
    const CLASS_BUTTON_RESET    = "btn-reset-filter";

    // How the filter types are displayed to the user
    const filterTypeDefs =
    [
        {"ftVal": FilterTypeEnum.FT_ON,         "ftLabel": "On/in",     "ftPrefix": "=="},
        {"ftVal": FilterTypeEnum.FT_BEFORE,     "ftLabel": "Before",    "ftPrefix": "<"},
        {"ftVal": FilterTypeEnum.FT_AFTER,      "ftLabel": "After",     "ftPrefix": ">"},
        {"ftVal": FilterTypeEnum.FT_NOT,        "ftLabel": "Not on/in", "ftPrefix": "!="},
        {"ftVal": FilterTypeEnum.FT_BETWEEN,    "ftLabel": "Between"},
        {"ftVal": FilterTypeEnum.FT_UNKNOWN,    "ftLabel": "Unknown"}
    ];

    // Default filter settings
    const DEFAULT_TYPE_VALUE    = FilterTypeEnum.FT_ON;
    const DEFAULT_DATE_STR      = "";

    function getFilterTypeIdx(filterVal)
    {
        return filterTypeDefs.findIndex(function(filterItem) { return filterItem.ftVal == filterVal; });
    }

    function DateFilterComponent() {}

    //
    // [IFilterComp]: init(params: IFilterParams): void;
    //      Called on the filter once
    //
    // Sets up the control's HTML markup and associated logic
    //
    DateFilterComponent.prototype.init = function(params)
    {
        // Cache the filter parameters
        this.filterParams = params;

        this.gui = document.createElement("div");
        this.gui.classList.add(CLASS_DATE_FILTER);

        // Set up the filter type dropdown
        this.filterType = document.createElement("select");
        this.filterType.classList.add(CLASS_FILTER_CHILD);
        this.filterType.classList.add(CLASS_FILTER_DROPDOWN);
        for (let idx = 0; idx < filterTypeDefs.length; idx++)
        {
            let selectOption = document.createElement("option");
            selectOption.setAttribute("value", filterTypeDefs[idx].ftVal);
            selectOption.innerHTML = filterTypeDefs[idx].ftLabel;
            this.filterType.appendChild(selectOption);
        }

        // Set up the start/end date controls
        this.startDateControl = getDateControl();
        this.startDateControl.getGui().classList.add(CLASS_START_DATE);
        this.startDateControl.getGui().classList.add(CLASS_FILTER_CHILD);

        this.endDateControl = getDateControl();
        this.endDateControl.getGui().classList.add(CLASS_END_DATE);
        this.endDateControl.getGui().classList.add(CLASS_FILTER_CHILD);

        // Set up a pane that divides the filter settings and button pane
        let dividerPane = document.createElement("div");
        let divider = document.createElement("hr");
        divider.classList.add(CLASS_FILTER_DIVIDER);
        dividerPane.appendChild(divider);

        // Set up the clear/reset button pane
        let buttonPane = document.createElement("div");
        buttonPane.classList.add(CLASS_BUTTON_PANE);
        buttonPane.classList.add(CLASS_FILTER_CHILD);

        let buttonClear = document.createElement("button");
        buttonClear.classList.add(CLASS_BUTTON_CLEAR);
        buttonClear.innerHTML = "Clear Filter";

        let buttonReset = document.createElement("button");
        buttonReset.classList.add(CLASS_BUTTON_RESET);
        buttonReset.innerHTML = "Reset Filter";

        buttonPane.appendChild(buttonClear);
        buttonPane.appendChild(buttonReset);

        this.gui.appendChild(this.filterType);
        this.gui.appendChild(this.startDateControl.getGui());
        this.gui.appendChild(this.endDateControl.getGui());
        this.gui.appendChild(dividerPane);
        this.gui.appendChild(buttonPane);

        this.setupGuiHooks();

        // Set up the function that retrieves the value of a row for testing
        // against the filter
        this.valueGetter = params.valueGetter;
        if (!this.valueGetter)
        {
            let fieldName = params.colDef.field;
            this.valueGetter = function(rowFilterParams) { return (rowFilterParams.data[fieldName]); };
        }
    }

    //
    // Sets up the GUI's event handlers and hooks
    //
    DateFilterComponent.prototype.setupGuiHooks = function()
    {
        // Resynch the GUI when the filter type changes.
        this.filterType.addEventListener("change", this.filterTypeChanged.bind(this));

        // Reapply the filter when the start/end date controls signal a change
        this.startDateControl.getGui().addEventListener(DATE_CHANGE_EVENT_TYPE, this.reapplyFilter.bind(this));
        this.endDateControl.getGui().addEventListener(DATE_CHANGE_EVENT_TYPE, this.reapplyFilter.bind(this));

        // Set up the buttons for clearing/resetting the filter
        let clearButton = this.gui.querySelector(CLASS_SELECTOR(CLASS_BUTTON_CLEAR));
        clearButton.addEventListener("click", this.clearDates.bind(this));

        let resetButton = this.gui.querySelector(CLASS_SELECTOR(CLASS_BUTTON_RESET));
        resetButton.addEventListener("click", this.resetFilter.bind(this));

        // Ensure sensible initial settings/appearance
        this.resetFilter();
    }

    //
    // When the filter type changes, resynch the GUI and refilter
    //
    DateFilterComponent.prototype.filterTypeChanged = function(event)
    {
        this.synchGUI();
        this.reapplyFilter();
    }

    //
    // Show/hide date controls according to the filter type selected
    //
    DateFilterComponent.prototype.synchGUI = function()
    {
        let hideStartDate   = (this.filterType.value == FilterTypeEnum.FT_UNKNOWN);
        let hideEndDate     = (this.filterType.value != FilterTypeEnum.FT_BETWEEN);
        this.startDateControl.getGui().hidden = hideStartDate;
        this.endDateControl.getGui().hidden = hideEndDate;
    }

    //
    // Force recalculation of the filter
    //
    DateFilterComponent.prototype.reapplyFilter = function(event)
    {
        this.filterParams.filterChangedCallback();
    }

    //
    // Apply default start/end dates with optional bubbling of associated
    // change events
    //
    DateFilterComponent.prototype.applyDefaultDates = function(bubble = true)
    {
        this.startDateControl.setDate(DEFAULT_DATE_STR, bubble);
        this.endDateControl.setDate(DEFAULT_DATE_STR, bubble);
    }

    //
    // Apply default filter settings with optional bubbling of associated
    // change events
    //
    DateFilterComponent.prototype.applyDefaults = function(bubble = true)
    {
        this.filterType.selectedIndex = getFilterTypeIdx(DEFAULT_TYPE_VALUE);
        this.applyDefaultDates(bubble);
    }

    //
    // Reset start/end date values
    //
    DateFilterComponent.prototype.clearDates = function(event)
    {
        this.applyDefaultDates();
    }

    //
    // Reset the filter
    //
    DateFilterComponent.prototype.resetFilter = function()
    {
        this.applyDefaults();
        this.synchGUI();
    }

    //
    // [IFilterComp] getGui(): any;
    //      Returns the GUI for this filter.
    //      The GUI can be a) a string of HTML or b) a DOM element or node.
    //
    DateFilterComponent.prototype.getGui = function()
    {
        return this.gui;
    }

    //
    // [IFilterComp]: isFilterActive(): boolean;
    //      Return true if the filter is active.
    //      If active then
    //      1) the grid will show the filter icon in the column header
    //      2) the filter will be included in the filtering of the data.
    //
    // The filter is active when the required date inputs have valid values
    //
    DateFilterComponent.prototype.isFilterActive = function()
    {
        let filterTypeVal = parseInt(this.filterType.value);
        if (filterTypeVal == FilterTypeEnum.FT_UNKNOWN)
        {
            return true;
        }

        let startDate   = parseDateComponents(this.startDateControl.getDate());
        let endDate     = parseDateComponents(this.endDateControl.getDate());

        return (startDate &&
               (endDate || filterTypeVal != FilterTypeEnum.FT_BETWEEN));
    }

    //
    // [IFilterComp]: doesFilterPass(params: IDoesFilterPassParams): boolean;
    //      The grid will ask each active filter, in turn, whether each row in
    //      the grid passes.
    //      If any filter fails, then the row will be excluded from the final set.
    //      A params object is supplied containing attributes of node (the
    //      rowNode the grid creates that wraps the data) and data (the data
    //      object that you provided to the grid for that row).
    //
    // If the filter isn't active, let everything through.
    // Otherwise, compare the row's date with the start date and end date as
    // required by the filter type.
    //
    DateFilterComponent.prototype.doesFilterPass = function(rowFilterParams)
    {
        let pass = true;

        if (this.isFilterActive())
        {
            let rowDate         = this.valueGetter(rowFilterParams);
            let filterTypeVal   = parseInt(this.filterType.value);

            if (filterTypeVal == FilterTypeEnum.FT_UNKNOWN)
            {
                pass = (!rowDate || !Object.keys(rowDate).length);
            }
            else if (rowDate)
            {
                let startDate   = parseDateComponents(this.startDateControl.getDate());
                let endDate     = parseDateComponents(this.endDateControl.getDate());

                let startDateComparison = compareDateComponents(startDate, rowDate);
                let endDateComparison   = compareDateComponents(endDate, rowDate);

                switch(filterTypeVal)
                {
                    case FilterTypeEnum.FT_ON:
                        pass = (startDateComparison == 0);
                        break;

                    case FilterTypeEnum.FT_AFTER:
                        pass = (startDateComparison < 0);
                        break;

                    case FilterTypeEnum.FT_BEFORE:
                        pass = (startDateComparison > 0);
                        break;

                    case FilterTypeEnum.FT_NOT:
                        pass = (startDateComparison);
                        break;

                    case FilterTypeEnum.FT_BETWEEN:
                        pass = (startDateComparison < 0 && endDateComparison > 0);
                        break;
                }
            }
            else
            {
                pass = false;
            }
        }

        return pass;
    }

    // [IFilterComp]: getModel(): any;
    //      Gets the filter state.
    //      If filter is not active, then should return null/undefined.
    //      The grid calls getModel() on all active filters when
    //      gridApi.getFilterModel() is called.
    //
    DateFilterComponent.prototype.getModel = function()
    {
        let model = null;
        if (this.isFilterActive())
        {
            let filterTypeVal = parseInt(this.filterType.value);

            model = {};
            model[DATE_FILTER_MODEL_TYPE] = filterTypeVal;

            if (filterTypeVal != FilterTypeEnum.FT_UNKNOWN)
            {
                model[DATE_FILTER_MODEL_START_DATE] = this.startDateControl.getDate();

                if (filterTypeVal == FilterTypeEnum.FT_BETWEEN)
                {
                    model[DATE_FILTER_MODEL_END_DATE] = this.endDateControl.getDate();
                }
            }
        }
        return model;
    }

    //
    // [IFilterComp]: getModelAsString?(model: any): string;
    //      If floating filters are turned on for the grid, but you have no
    //      floating filter configured for this column, then the grid will
    //      check for this method.
    //      If this method exists, then the grid will provide a read-only
    //      floating filter for you and display the results of this method.
    //      For example, if your filter is a simple filter with one string
    //      input value, you could just return the simple string value here.
    //
    DateFilterComponent.prototype.getModelAsString = function(model)
    {
        let modelStr = null;
        if (model)
        {
            let filterTypeVal = model[DATE_FILTER_MODEL_TYPE];
            let filterTypeDef = filterTypeDefs[getFilterTypeIdx(filterTypeVal)];
            let startDate     = this.startDateControl.getDate();
            let endDate       = this.endDateControl.getDate();

            switch(filterTypeVal)
            {
                case FilterTypeEnum.FT_UNKNOWN:
                    modelStr = "Unknown";
                    break;

                case FilterTypeEnum.FT_ON:
                case FilterTypeEnum.FT_BEFORE:
                case FilterTypeEnum.FT_AFTER:
                case FilterTypeEnum.FT_NOT:
                    modelStr = filterTypeDef["ftPrefix"] + " " + startDate;
                    break;

                case FilterTypeEnum.FT_BETWEEN:
                    modelStr = "(" + startDate + ", " + endDate + ")";
            }
        }

        return modelStr;
    }

    //
    // Updates the filter settings based on a model.
    // Bubbling of events is suppressed so that recalculation of the filter
    // can be deferred until the entire model is applied.
    //
    DateFilterComponent.prototype.updateModel = function(model)
    {
        if (model)
        {
            let currFilterTypeVal   = parseInt(this.filterType.value);
            let filterTypeVal       = model[DATE_FILTER_MODEL_TYPE];
            let filterStartDate     = model[DATE_FILTER_MODEL_START_DATE];
            let filterEndDate       = model[DATE_FILTER_MODEL_END_DATE];

            // A hack...
            // If the current filter type is between and the new model only
            // provides no filter type, a start date, and no end date,
            // reset the filter type.
            if (currFilterTypeVal == FilterTypeEnum.FT_BETWEEN &&
                !filterTypeVal && filterStartDate && !filterEndDate)
            {
                filterTypeVal = DEFAULT_TYPE_VALUE;
            }

            let filterTypeIndex = getFilterTypeIdx(filterTypeVal);
            if (filterTypeIndex != -1)
            {
                this.filterType.selectedIndex = filterTypeIndex;
            }

            //
            // Suppress bubbling of the change events from the date controls,
            // so that processing of these events by the filter can be deferred
            // until the whole model is updated.
            //
            // TODO: Should I bother to check the filter type before setting?
            //
            if (filterTypeVal != FilterTypeEnum.FT_UNKNOWN)
            {
                this.startDateControl.setDate(filterStartDate, false);
            }

            if (filterTypeVal == FilterTypeEnum.FT_BETWEEN)
            {
                this.endDateControl.setDate(filterEndDate, false);
            }
        }
        else
        {
            // Reset the filter
            this.applyDefaults(false);
        }
    }

    //
    // [IFilterComp]: setModel(model: any): void;
    //      Restores the filter state.
    //      Called by the grid after gridApi.setFilterModel(model) is called.
    //      The grid will pass undefined/null to clear the filter.
    //
    DateFilterComponent.prototype.setModel = function(model)
    {
        this.updateModel(model);
        this.synchGUI();
        this.reapplyFilter();
    }

    return DateFilterComponent;
}


//
// Custom floating equivalent for the custom date filter component
// (implements IFloatingFilterComp).
// When the filter requires a single date (e.g. condition is "On/in 2003"),
// the floating filter allows editing of this date.
// Otherwise, the floating filter displays a read-only representation of the
// filter condition.
//
function getDateFloatingFilterComponent()
{
    function DateFloatingFilterComponent() {}

    //
    // [IFloatingFilterComp]: init(params: IFilterFloatingParams): void;
    //      Called on the floating filter once.
    //      IFloatingFilterParams:
    //      column: Column;
    //          The column this filter is for
    //      filterParams: IFilterParams;
    //          The params object passed to the parent filter.
    //          Allows access to the configuration of the parent filter.
    //      currentParentModel(): any;
    //          A shortcut to getModel() on the parent parent filter.
    //          If the parent filter doesn't exist (filters are lazily created as needed)
    //          returns null rather than calling getModel() on the parent filter.
    //      suppressFilterButton: boolean;
    //          Boolean flag to indicate if the button in the floating filter that
    //          opens the parent filter in a popup should be displayed
    //      parentFilterInstance: (callback: (filterInstance: IFilterComp) => void) => void;
    //          Gets a reference to the parent filter, returned asynchonously
    //          via a callback as the parent filter may not exist yet.
    //
    //          The floating filter can then call any method on the parent filter.
    //          The parent filter will typically provide its own method for the
    //          floating filter to call to set the filter.
    //          For example, if creating custom filter A, it should have a method your
    //          floating A can call to set the state when the user updates via the
    //          floating filter.
    //      api: any;
    //          The grid API
    //
    DateFloatingFilterComponent.prototype.init = function(params)
    {
        // Cache initiation parameters for later use
        this.filterParams = params;

        // Root HTML element that hosts both date controls
        this.root = document.createElement("div");
        this.root.style.setProperty("display", "flex");
        this.root.style.setProperty("align-items", "center");   // Vertically centre child elements

        // Editable and read-only date controls:
        // Only one is visible, depending on the underlying filter settings.
        this.editableDateControl = getDateControl();
        this.readonlyDateControl = document.createElement("input");

        // Styling that applies to both controls
        const commonStyleProperties =
        {
            "position":     "absolute",
            "left":         "0",            // Anchor to left of parent element
            "max-height":   "80%",
            "width":        "100%",
            "padding":      "0",
            "margin":       "0",
            "overflow":     "hidden"        // Hide parts of the date controls
                                            // that exceed the parent's boundaries
        }

        // Apply common styling to controls
        for (let propName in commonStyleProperties)
        {
            let propValue = commonStyleProperties[propName];
            this.editableDateControl.root.style.setProperty(propName, propValue);
            this.readonlyDateControl.style.setProperty(propName, propValue);
        }

        //this.editableDateControl.getGui().classList.add("w-100");

        // Configure the read-only date control
        this.readonlyDateControl.setAttribute("type", "text");
        this.readonlyDateControl.setAttribute("disabled", "true");
        this.readonlyDateControl.style.setProperty("border", "solid");
        this.readonlyDateControl.style.setProperty("border-width", "thin");

        // Add both controls as child elements
        this.root.appendChild(this.editableDateControl.root);
        this.root.appendChild(this.readonlyDateControl);

        this.root.addEventListener(DATE_CHANGE_EVENT_TYPE, this.filterChanged.bind(this));

        this.configureGUI(this.filterParams.currentParentModel());
    }

    //
    // Determines which date control to show based on the parent filter's model
    //
    DateFloatingFilterComponent.prototype.configureGUI = function(filterModel)
    {
        // Local references to the controls (for convenience)
        let editableControl = this.editableDateControl;
        let readonlyControl = this.readonlyDateControl;

        if (filterModel != null)
        {
            // Display the filter's model string in the read-only control
            this.filterParams.parentFilterInstance(function(parentFilter) { readonlyControl.placeholder = parentFilter.getModelAsString(filterModel); });
            switch(filterModel.type)
            {
                case FilterTypeEnum.FT_BETWEEN:
                case FilterTypeEnum.FT_UNKNOWN:
                    editableControl.root.style.setProperty("visibility", "hidden");
                    readonlyControl.style.setProperty("visibility", "visible");
                    return;

                default:
                    editableControl.setDate(filterModel[DATE_FILTER_MODEL_START_DATE], false);
            }
        }
        else
        {
            readonlyControl.placeholder = "";
            editableControl.setDate("", false);
        }

        editableControl.root.style.setProperty("visibility", "visible");
        readonlyControl.style.setProperty("visibility", "hidden");

    }

    //
    // [IFloatingFilterComp]: onParentModelChanged(parentModel: any, event: FilterChangeEvent): void;
    //      Gets called every time the parent filter changes.
    //      The floating filter would typically refresh its UI to reflect the
    //      new filter state. The provided parentModel is returned by the
    //      parent filter's getModel() method.
    //      The event is the FilterChangedEvent that the grid fires.
    //
    DateFloatingFilterComponent.prototype.onParentModelChanged = function(parentModel, event)
    {
        let modelStr = "";
        this.filterParams.parentFilterInstance(function(parentFilter) { modelStr = parentFilter.getModelAsString(parentModel); });

        this.configureGUI(parentModel);
    }

    //
    // [IFloatingFilterComp]: getGui(): HTMLElement;
    //      Returns the HTML element for this floating filter.
    //
    DateFloatingFilterComponent.prototype.getGui = function()
    {
        return this.root;
    }

    //
    //
    //
    DateFloatingFilterComponent.prototype.filterChanged = function(event)
    {
        let currentModel = this.filterParams.currentParentModel() || {};
        currentModel[DATE_FILTER_MODEL_START_DATE] = this.editableDateControl.getDate();

        this.filterParams.parentFilterInstance(function(parentFilter) { parentFilter.setModel(currentModel); });
    }

    // Gets called when the floating filter is destroyed. Like column headers,
    // the floating filter lifespan is only when the column is visible,
    // so they are destroyed if the column is made not visible or when a user
    // scrolls the column out of view with horizontal scrolling.
    //destroy?(): void;

    return DateFloatingFilterComponent;
}
