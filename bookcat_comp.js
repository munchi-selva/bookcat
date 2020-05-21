//
// Miscellaneous components used to display the book catalogue
//

// Date picker implementation, stolen from:
// https://www.ag-grid.com/javascript-grid-cell-editing/#example-datepicker-cell-editing
function getDatePicker()
{
    function Datepicker() {}

    // Constructor... I think
    Datepicker.prototype.init = function(params)
    {
        // Create the cell
        this.eInput = document.createElement("input");
        this.eInput.value = params.value;

        // From: https://jqueryui.com/datepicker/
        $(this.eInput).datepicker({dateFormat: "yy-mm-dd"});
    };

    // Called once when the grid is ready to insert the element
    Datepicker.prototype.getGui = function()
    {
        return this.eInput;
    };

    // Focus and select: possible after the gui is attached
    Datepicker.prototype.afterGuiAttached = function()
    {
        this.eInput.focus();
        this.eInput.select();
    };

    // Returns the new value after editing
    Datepicker.prototype.getValue = function()
    {
        return this.eInput.value;
    };

    // Cleanup
    Datepicker.prototype.destroy = function()
    {
        // Nothing to do
    };

    // if true, then this editor will appear in a popup
    Datepicker.prototype.isPopup = function()
    {
        // and we could leave this method out also, false is the default
        return true;
    };

    return Datepicker;
}


function getDateComponent()
{
    function DateComp() {}


    // Constructor... I think
    DateComp.prototype.init = function(params)
    {
        let that = this;

        this.params = params;

        // Create the cell
        this.gui = document.createElement("div");

        // Alias for this.gui for convenience
        let gui = this.gui;

        // Set up class membership
        gui.classList.add("ag-input-wrapper");
        gui.classList.add("custom-date-filter");
        gui.classList.add("grid-container");

        gui.innerHTML = "<div class='grid-container' style='grid-template-columns: auto auto'>" +
                            "<input type='text' class='manualDateInput'></input>" +
                            "<button id='dateInputLaunch'>" +
                        "</div>" +
                        "<input type='text' class='hidden-date-input'></input>";


        this.datewidget = flatpickr(gui.querySelector(".hidden-date-input"),
                                    {
                                        dateFormat: "Y-m-d",
                                        onChange: this.onDateChanged.bind(this)
                                    });


        this.datewidget.calendarContainer.classList.add("ag-custom-component-popup");

        let button = gui.querySelector("#dateInputLaunch");
        button.addEventListener("click", launchPicker);

        let manualInput = gui.querySelector(".manualDateInput");
        manualInput.addEventListener("change", updateDate);
        function updateDate(event)
        {
            let newDate = that.gui.querySelector(".manualDateInput").value;
            that.datewidget.setDate(newDate, false);
            that.params.onDateChanged();
        }

        function launchPicker(event)
        {
            that.datewidget.open();
        }
    };

    // Called once when the grid is ready to insert the element
    DateComp.prototype.getGui = function()
    {
        return this.gui;
    };

    DateComp.prototype.onDateChanged = function(selectedDates, dateStr, instance)
    {
        let dateInputElem = this.gui.querySelector(".manualDateInput");
        dateInputElem.value = dateStr;
        this.params.onDateChanged();
    };

    // Returns the new value after editing
    DateComp.prototype.getDate = function()
    {
        return this.datewidget.selectedDates[0];
    };

    DateComp.prototype.setDate = function(date)
    {
        this.datewidget.setDate(date);
    }

    DateComp.prototype.setInputPlaceholder = function(placeholder)
    {
        this.gui.querySelector(".manualDateInput").setAttribute("placeholder", placeholder);
    }

    // Cleanup
    DateComp.prototype.destroy = function()
    {
        // Nothing to do
    };

    return DateComp;
}


//
// Custom date filter component that presents:
//  * A dropdown providing various filter types, e.g. on/in, after, etc.
//  * Start/end date selection components, comprising
//      - A text field for manual input of dates
//      - A button that launches a date picker
// The text field and date picker are synched.
// Dates have the format yyyy-mm-dd.
// Incomplete dates (yyyy, yyyy-mm) are supported.
//
function getDateFilterComponent()
{
    // Default settings
    const DEFAULT_TYPE_INDEX    = 0;
    const DEFAULT_DATE_STR      = "";

    // Custom date input change event properties
    const DATE_CHANGE_EVENT_TYPE           = "change";
    const DATE_CHANGE_EVENT_DETAILS        = "detail";
    const DATE_CHANGE_EVENT_UPDATE_PICKER  = "updateDatePicker";

    // Filter model property names
    const FILTER_MODEL_TYPE         = "type";
    const FILTER_MODEL_START_DATE   = "start_date";
    const FILTER_MODEL_END_DATE     = "end_date";

    function DateFilterComponent() {}

    DateFilterComponent.prototype.init = function(params)
    {
        //this.params = params;

        // Set up the HTML markup and the logic that sits behind it
        this.gui = document.createElement("div");
        this.gui.classList.add("grid-container");
        this.gui.innerHTML = "<select>" +
                                "<option value='on'>On/in</option>" +
                                "<option value='after'>After</option>" +
                                "<option value='before'>Before</option>" +
                                "<option value='not'>Not on/in</option>" +
                                "<option value='between'>Between</option>" +
                                "<option value='unknown'>Unknown</option>" +
                             "</select>" +

                             "<div class='date-input-wrapper start-date'>" +
                                "<div class='grid-container' style='grid-template-columns: auto auto'>" +
                                    "<input type='text' class='date-input start-date'></input>" +
                                    "<button class='btn-date-launcher'>" +
                                "</div>" +
                                "<input type='text' class='hidden-date-input'></input>" +
                             "</div>" +

                             "<div class='date-input-wrapper end-date' hidden='true'>" +
                                "<div class='grid-container' style='grid-template-columns: auto auto'>" +
                                    "<input type='text' class='date-input end-date'></input>" +
                                    "<button class='btn-date-launcher'>" +
                                "</div>" +
                                "<input type='text' class='hidden-date-input'></input>" +
                             "</div>" +

                             "<div style='text-align: right'>"+
                                "<button class='btn-filter-clear'>Clear</button>" +
                                "<button class='btn-filter-reset'>Reset</button>" +
                             "</div>";
        this.setupGuiHooks(params);

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
    DateFilterComponent.prototype.setupGuiHooks = function(params)
    {
        // Make a copy of the this pointer for use in sub-functions,
        // which have a different definition of this.
        let filterComp = this;

        let dateInputWrappers = this.gui.querySelectorAll(".date-input-wrapper");
        for (let idx = 0; idx < dateInputWrappers.length; idx++)
        {
            let dateInputWrapper    = dateInputWrappers[idx];
            let dateInput           = dateInputWrapper.querySelector(".date-input");
            let hiddenDateInput     = dateInputWrapper.querySelector(".hidden-date-input");
            let launcherBtn         = dateInputWrapper.querySelector(".btn-date-launcher");

            // Set up a change event handler on the visible date input
            dateInput.addEventListener("change", dateInputChanged);

            // Set up the date picker, attaching it to the hidden input.
            // When a date is picked, notify the visible date input, but
            // ensure the change event handler won't update the date picker
            // (i.e. avoid a recursive loop of events).
            let datePicker = flatpickr(hiddenDateInput,
                                       {
                                            dateFormat:  "Y-m-d",
                                            onChange: function(selectedDates, dateStr, instance)
                                            {
                                                filterComp.raiseDateInputChange(dateInput, dateStr, false);
                                            }
                                        });

            // Ensure that clicking within the date picking widget is
            // interpreted as a selection within the customer filter component.
            datePicker.calendarContainer.classList.add("ag-custom-component-popup");

            // Set up the launcher button to launch the date picker
            launcherBtn.addEventListener("click", function() { datePicker.open(); });
        }

        // For convenience, save the filter type as a member variable.
        // Resynch the GUI when the filter type changes.
        this.filterType = this.gui.querySelector("select");
        this.filterType.addEventListener("change", function(event) { filterComp.synchGUI(); });

        // Set up the buttons for clearing/resetting the filter
        let clearButton = this.gui.querySelector(".btn-filter-clear");
        clearButton.addEventListener("click", clearDates);

        let resetButton = this.gui.querySelector(".btn-filter-reset");
        resetButton.addEventListener("click", function(event) { filterComp.resetFilter(); });

        // Ensure sensible initial settings/appearance
        this.resetFilter();

        // 1. [Optional] Synchs the manual date input and date picker
        // 2. Recalculates the filter results
        function dateInputChanged(event)
        {
            let dateStr             = this.value;
            let dateComponents      = parseDateComponents(dateStr);
            let updateDatePicker    = true;

            // Temporary validation code
            if (dateStr && !dateComponents)
            {
                this.style.setProperty("background-color", "red");
            }
            else
            {
                this.style.removeProperty("background-color");
            }

            // Check whether the picker should be updated
            let eventDetail = event[DATE_CHANGE_EVENT_DETAILS];
            if (eventDetail)
            {
                updateDatePicker = eventDetail[DATE_CHANGE_EVENT_UPDATE_PICKER];
            }

            if (updateDatePicker)
            {
                // Dodgy! Find the picker...
                let datePicker = this.parentElement.nextSibling._flatpickr;
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
            params.filterChangedCallback();
        }

        // Clear the manual date inputs
        function clearDates(event)
        {
            filterComp.gui.querySelectorAll(".date-input").forEach(function(dateInput)
                                                                  {
                                                                      filterComp.raiseDateInputChange(dateInput, DEFAULT_DATE_STR, true);
                                                                  });
        }
    }

    // 1. [Optional] Sets the value of the manual date input
    // 2. Raises a change event on the manual date input
    DateFilterComponent.prototype.raiseDateInputChange = function(dateInput, dateStr, updateDatePicker)
    {
        let changeEventDetails = {};
        changeEventDetails[DATE_CHANGE_EVENT_DETAILS] = {};
        changeEventDetails[DATE_CHANGE_EVENT_DETAILS][DATE_CHANGE_EVENT_UPDATE_PICKER] = updateDatePicker;
        let changeEvent = new CustomEvent(DATE_CHANGE_EVENT_TYPE, changeEventDetails);

        if (dateStr != null)
        {
            dateInput.value = dateStr;
        }
        dateInput.dispatchEvent(changeEvent);
    }

    // Apply default filter settings
    DateFilterComponent.prototype.applyDefaults = function()
    {
        this.filterType.selectedIndex = DEFAULT_TYPE_INDEX;
        this.gui.querySelectorAll(".date-input").forEach(function(dateInput) { dateInput.value = DEFAULT_DATE_STR; });
    }

    // 1. Show/hide filter options according to the filter type selected
    // 2. Ensure manual date inputs and date pickers are in synch
    DateFilterComponent.prototype.synchGUI = function()
    {
        let hideStartDate   = (this.filterType.value == "unknown");
        let hideEndDate     = (this.filterType.value != "between");
        this.gui.querySelector(".date-input-wrapper.start-date").hidden = hideStartDate;
        this.gui.querySelector(".date-input-wrapper.end-date").hidden = hideEndDate;

        let dateInputs = this.gui.querySelectorAll(".date-input");
        for (let idx = 0; idx < dateInputs.length; idx++)
        {
            this.raiseDateInputChange(dateInputs[idx], null, true);
        }
    }

    // Reset the filter
    DateFilterComponent.prototype.resetFilter = function()
    {
        this.applyDefaults();
        this.synchGUI();
    }

    DateFilterComponent.prototype.getGui = function()
    {
        return this.gui;
    }

    //
    // The filter is active when the required date inputs have valid values
    //
    DateFilterComponent.prototype.isFilterActive = function()
    {
        if (this.filterType.value == "unknown")
        {
            return true;
        }

        let startDate   = parseDateComponents(this.gui.querySelector(".date-input.start-date").value);
        let endDate     = parseDateComponents(this.gui.querySelector(".date-input.end-date").value);

        return (startDate &&
               (endDate || this.filterType.value != "between"));
    }

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
            let rowDate     = this.valueGetter(rowFilterParams);
            let filterType  = this.filterType.value;

            if (filterType == "unknown")
            {
                pass = (!rowDate || !Object.keys(rowDate).length);
            }
            else if (rowDate)
            {
                let startDate   = parseDateComponents(this.gui.querySelector(".date-input.start-date").value);
                let endDate     = parseDateComponents(this.gui.querySelector(".date-input.end-date").value);

                let startDateComparison = compareDateComponents(startDate, rowDate);
                let endDateComparison   = compareDateComponents(endDate, rowDate);

                switch(filterType)
                {
                    case "on":
                        pass = (startDateComparison == 0);
                        break;

                    case "after":
                        pass = (startDateComparison < 0);
                        break;

                    case "before":
                        pass = (startDateComparison > 0);
                        break;

                    case "not":
                        pass = (startDateComparison);
                        break;

                    case "between":
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

    DateFilterComponent.prototype.getModel = function()
    {
        let model = null;
        if (this.isFilterActive())
        {
            model = {};
            model[FILTER_MODEL_TYPE] = this.filterType.value;
            if (this.filterType.value != "unknown")
            {
                model[FILTER_MODEL_START_DATE] = this.gui.querySelector(".date-input.start-date").value;
                if (this.filterType.value == "between")
                {
                    model[FILTER_MODEL_END_DATE] = this.gui.querySelector(".date-input.end-date").value;
                }
            }
        }
        return model;
    }

    DateFilterComponent.prototype.setModel = function(model)
    {
        if (model)
        {
            let filterType = model[FILTER_MODEL_TYPE];
            let filterTypeIndex = this.getFilterTypeIndex(filterType);
            let filterStartDate = model[FILTER_MODEL_START_DATE];
            let filterEndDate = model[FILTER_MODEL_END_DATE];

            if (filterTypeIndex != -1)
            {
                this.filterType.selectedIndex = filterTypeIndex;

                if (filterTypeIndex != 5)
                {
                    this.gui.querySelector(".date-input.start-date").value = filterStartDate;

                    if (filterTypeIndex == 4)
                    {
                        this.gui.querySelector(".date-input.end-date").value = filterEndDate;
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

    DateFilterComponent.prototype.getFilterTypeIndex = function(filterType)
    {
        switch(filterType)
        {
            case "on":
                return 0;

            case "after":
                return 1;

            case "before":
                return 2;

            case "not":
                return 3;

            case "between":
                return 4;

            case "unknown":
                return 5;
        }

        return -1;
    }

    return DateFilterComponent;
}
