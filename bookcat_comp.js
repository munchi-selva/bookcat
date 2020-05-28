//
// Miscellaneous components used to display the book catalogue
//

// HTML classes shared below
const CLASS_GRID_CONTAINER      = "grid-container";

// Custom date input change event properties
const DATE_CHANGE_EVENT_TYPE            = "change";
const DATE_CHANGE_EVENT_DETAILS         = "detail";
const DATE_CHANGE_EVENT_UPDATE_PICKER   = "updateDatePicker";
const EVENT_BUBBLE_OPTION               = "bubbles";


// Macro-ish function that converts the input parameter to a CSS class selector
function CLASS_SELECTOR(className)
{
    return "." + className;
}




//
// A custom date control comprising:
//  * A text input for manual input of dates
//  * A button that launches a date picker
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
    const CLASS_DATE_LAUNCHER_BTN   = "btn-date-launcher";

    function DateControl()
    {
        this.init();
    }

    //
    // Sets up the control's HTML markup and associated logic.
    // The markup looks something like this:
    // <div class="date-input-wrapper">
    //     <div class="grid-container" style="grid-template-columns: auto 20%">
    //         <input type="text" class="date-input"></input>
    //         <button class="btn-date-launcher">
    //     </div>
    //     <input type='text' class='hidden-date-input'></input>";
    // </div>
    //
    DateControl.prototype.init = function()
    {
        let dateControl = this;

        // Main element
        this.root = document.createElement("div");
        this.root.classList.add(CLASS_DATE_INPUT_WRAPPER);

        // Set up the manual date input, hidden date input & launcher button
        let inputGrid = document.createElement("div");

        inputGrid.classList.add(CLASS_GRID_CONTAINER);
        inputGrid.style.setProperty("grid-template-columns", "auto 0% auto");

        let dateInput = document.createElement("input");
        dateInput.classList.add(CLASS_DATE_INPUT);

        let hiddenDateInput = document.createElement("input");
        hiddenDateInput.classList.add(CLASS_HIDDEN_DATE_INPUT);

        let launcherBtn = document.createElement("button");
        launcherBtn.classList.add(CLASS_DATE_LAUNCHER_BTN);
        launcherBtn.innerHTML = "&#x25BC;";

        inputGrid.appendChild(dateInput);
        inputGrid.appendChild(hiddenDateInput);
        inputGrid.appendChild(launcherBtn);

        this.root.appendChild(inputGrid);

        // Cache a reference to the date input for later use
        this.dateInput = dateInput;

        // Attach the event handlers, etc.
        this.setupGuiHooks();
    }

    DateControl.prototype.setupGuiHooks = function()
    {
        let dateControl = this;

        // Get access to the miscellaneous elements of the control
        let hiddenDateInput = this.root.querySelector(CLASS_SELECTOR(CLASS_HIDDEN_DATE_INPUT));
        let launcherBtn     = this.root.querySelector(CLASS_SELECTOR(CLASS_DATE_LAUNCHER_BTN));

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
        launcherBtn.addEventListener("click", function() { datePicker.open(); });
    }

    // Synchs the manual date input and date picker, if required
    DateControl.prototype.onDateInputChanged = function(event)
    {
        let target              = event.target;
        let dateStr             = target.value;
        let dateComponents      = parseDateComponents(dateStr);
        let updateDatePicker    = true;

        // Temporary validation code
        if (dateStr && !dateComponents)
        {
            target.style.setProperty("background-color", "red");
        }
        else
        {
            target.style.removeProperty("background-color");
        }

        // Check whether the picker should be updated
        let eventDetail = event[DATE_CHANGE_EVENT_DETAILS];
        if (eventDetail)
        {
            updateDatePicker = eventDetail[DATE_CHANGE_EVENT_UPDATE_PICKER];
        }

        if (updateDatePicker)
        {
            // Find the picker...
            let datePicker = target.nextSibling._flatpickr;
            if (dateStr)
            {
                if (dateComponents)
                {
                    // setDate() for a fully specifed date, else jumpDate()
                    if (dateComponents[CAT_FLD_DATE_YEAR] &&
                        dateComponents[CAT_FLD_DATE_MONTH] &&
                        dateComponents[CAT_FLD_DATE_DAY])
                    {
                        datePicker.setDate(dateStr, false);
                    }
                    else
                    {
                        datePicker.jumpToDate(dateStr, false);
                    }
                }
            }
            else
            {
                datePicker.clear();
            }
        }
    }

    // 1. [Optional] Sets the value of the manual date input
    // 2. Raises a bubbling change event on the manual date input
    DateControl.prototype.raiseDateInputChange = function(dateStr, updateDatePicker)
    {
        let changeEventDetails = {};
        changeEventDetails[EVENT_BUBBLE_OPTION] = true;
        changeEventDetails[DATE_CHANGE_EVENT_DETAILS] = {};
        changeEventDetails[DATE_CHANGE_EVENT_DETAILS][DATE_CHANGE_EVENT_UPDATE_PICKER] = updateDatePicker;
        let changeEvent = new CustomEvent(DATE_CHANGE_EVENT_TYPE, changeEventDetails);

        if (dateStr != null)
        {
            this.dateInput.value = dateStr;
        }
        this.dateInput.dispatchEvent(changeEvent);
    }

    // Handles selection of a date in the picker selection
    DateControl.prototype.onDatePicked = function(selectedDates, dateStr, instance)
    {
        this.raiseDateInputChange(dateStr, false);
    }

    // Ensures the manual date input and date picker are synched
    DateControl.prototype.synchGUI = function()
    {
        this.raiseDateInputChange(null, true);
    }

    // Retrieves the date of the control
    DateControl.prototype.getDate = function()
    {
        return this.dateInput.value;
    }

    // Sets the date of the control
    DateControl.prototype.setDate = function(dateStr)
    {
        this.raiseDateInputChange(dateStr, true);
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
        // Set up the date control
        this.dateControl = getDateControl();

        // Rig the control's gui to the DateControl and initialise its date
        this.gui = this.dateControl.root;
        this.dateControl.setDate(params.formatValue(params.value));
    };

    //
    // [ICellEditorComp]: afterGuiAttached?(): void
    //      Gets called once after GUI is attached to DOM.
    //
    // Focuses on the date input so that editing can be done
    //
    DateComp.prototype.afterGuiAttached = function()
    {
        this.dateControl.dateInput.focus();
    };

    //
    // [ICellEditorComp]: getGui(): HTMLElement
    //      Returns the DOM element of the editor: what the grid puts into the DOM
    //
    DateComp.prototype.getGui = function()
    {
        return this.gui;
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
    // Other ICellEditorComp optional methods (not implemented)
    //
    // isCancelBeforeStart?(): boolean;
    //      Gets called once before editing starts, to give editor a chance to
    //      cancel the editing before it even starts.
    //
    // isCancelAfterEnd?(): boolean;
    //      Gets called once when editing is finished (e.g. if enter is pressed).
    //      If you return true, then the result of the edit will be ignored.
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
    const CLASS_START_DATE      = "start-date";
    const CLASS_END_DATE        = "end-date";
    const CLASS_CLEAR_BUTTON    = "btn-clear-filter";
    const CLASS_RESET_BUTTON    = "btn-reset-filter";

    // An enumeration representing the filter type identifiers
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

    // How the filter types are displayed to the user
    const filterTypes =
    [
        {"ftVal": FilterTypeEnum.FT_ON,         "ftLabel": "On/in"},
        {"ftVal": FilterTypeEnum.FT_BEFORE,     "ftLabel": "Before"},
        {"ftVal": FilterTypeEnum.FT_AFTER,      "ftLabel": "After"},
        {"ftVal": FilterTypeEnum.FT_NOT,        "ftLabel": "Not on/in"},
        {"ftVal": FilterTypeEnum.FT_BETWEEN,    "ftLabel": "Between"},
        {"ftVal": FilterTypeEnum.FT_UNKNOWN,    "ftLabel": "Unknown"}
    ];

    // Default filte settings
    const DEFAULT_TYPE_VALUE    = FilterTypeEnum.FT_ON;
    const DEFAULT_DATE_STR      = "";

    // Filter model property names
    const FILTER_MODEL_TYPE         = "type";
    const FILTER_MODEL_START_DATE   = "start_date";
    const FILTER_MODEL_END_DATE     = "end_date";

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
        this.gui.classList.add(CLASS_GRID_CONTAINER);

        // Set up the filter type dropdown
        this.filterType = document.createElement("select");
        for (let idx = 0; idx < filterTypes.length; idx++)
        {
            let selectOption = document.createElement("option");
            selectOption.setAttribute("value", filterTypes[idx].ftVal);
            selectOption.innerHTML = filterTypes[idx].ftLabel;
            this.filterType.appendChild(selectOption);
        }

        // Set up the start/end date controls
        this.startDateControl = getDateControl();
        this.startDateControl.root.classList.add(CLASS_START_DATE);

        this.endDateControl = getDateControl();
        this.endDateControl.root.classList.add(CLASS_END_DATE);

        // Set up the clear/reset button pane
        let buttonPane = document.createElement("div");
        buttonPane.style.setProperty("text-align", "right");

        let buttonClear = document.createElement("button");
        buttonClear.classList.add(CLASS_CLEAR_BUTTON);
        buttonClear.innerHTML = "Clear";

        let buttonReset = document.createElement("button");
        buttonReset.classList.add(CLASS_RESET_BUTTON);
        buttonReset.innerHTML = "Reset";

        buttonPane.appendChild(buttonClear);
        buttonPane.appendChild(buttonReset);

        this.gui.appendChild(this.filterType);
        this.gui.appendChild(this.startDateControl.root);
        this.gui.appendChild(this.endDateControl.root);
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
        this.filterType.addEventListener("change", this.synchGUI.bind(this));

        // Reapply the filter when the start/end date controls signal a change
        this.startDateControl.root.addEventListener(DATE_CHANGE_EVENT_TYPE, this.reapplyFilter.bind(this));
        this.endDateControl.root.addEventListener(DATE_CHANGE_EVENT_TYPE, this.reapplyFilter.bind(this));

        // Set up the buttons for clearing/resetting the filter
        let clearButton = this.gui.querySelector(CLASS_SELECTOR(CLASS_CLEAR_BUTTON));
        clearButton.addEventListener("click", this.clearDates.bind(this));

        let resetButton = this.gui.querySelector(CLASS_SELECTOR(CLASS_RESET_BUTTON));
        resetButton.addEventListener("click", this.resetFilter.bind(this));

        // Ensure sensible initial settings/appearance
        this.resetFilter();
    }

    //
    // 1. Show/hide date controls according to the filter type selected
    // 2. Ensure date controls' manual inputs and date pickers are in synch
    //
    DateFilterComponent.prototype.synchGUI = function()
    {
        let hideStartDate   = (this.filterType.value == FilterTypeEnum.FT_UNKNOWN);
        let hideEndDate     = (this.filterType.value != FilterTypeEnum.FT_BETWEEN);
        this.startDateControl.root.hidden = hideStartDate;
        this.endDateControl.root.hidden = hideEndDate;

        this.startDateControl.synchGUI();
        this.endDateControl.synchGUI();
    }

    // Force recalculation of the filter
    DateFilterComponent.prototype.reapplyFilter = function(event)
    {
        this.filterParams.filterChangedCallback();
    }

    // Clear the manual date inputs
    DateFilterComponent.prototype.clearDates = function(event)
    {
        this.startDateControl.setDate(DEFAULT_DATE_STR);
        this.endDateControl.setDate(DEFAULT_DATE_STR);
    }

    // Apply default filter settings
    DateFilterComponent.prototype.applyDefaults = function()
    {
        this.filterType.selectedIndex = filterTypes.findIndex(function(filterItem) { return filterItem.ftVal == DEFAULT_TYPE_VALUE; });
        this.clearDates();
    }

    // Reset the filter
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
            model[FILTER_MODEL_TYPE] = filterTypeVal;
            if (this.filterType.value != FilterTypeEnum.FT_UNKNOWN)
            {
                model[FILTER_MODEL_START_DATE] = this.startDateControl.getDate();
                if (filterTypeVal == FilterTypeEnum.FT_BETWEEN)
                {
                    model[FILTER_MODEL_END_DATE] = this.endDateControl.getDate();
                }
            }
        }
        return model;
    }


    //
    // [IFilterComp]: setModel(model: any): void;
    //      Restores the filter state.
    //      Called by the grid after gridApi.setFilterModel(model) is called.
    //      The grid will pass undefined/null to clear the filter.
    DateFilterComponent.prototype.setModel = function(model)
    {
        if (model)
        {
            let filterTypeVal   = model[FILTER_MODEL_TYPE];
            let filterTypeIndex = filterTypes.findIndex(function(filterItem) { return filterItem.ftVal == filterTypeVal; });
            let filterStartDate = model[FILTER_MODEL_START_DATE];
            let filterEndDate   = model[FILTER_MODEL_END_DATE];

            if (filterTypeIndex != -1)
            {
                this.filterType.selectedIndex = filterTypeIndex;

                if (filterTypeVal != FilterTypeEnum.FT_UNKNOWN)
                {
                    this.startDateControl.setDate(filterStartDate);

                    if (filterTypeVal == FilterTypeEnum.FT_BETWEEN)
                    {
                        this.endDateControl.setDate(filterEndDate);
                    }
                }
            }
            this.synchGUI();
        }
        else
        {
            this.resetFilter();
        }
    }

    return DateFilterComponent;
}
