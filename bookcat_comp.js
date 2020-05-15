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
    const REFILTER_EVENT_TYPE = "change";
    const REFILTER_EVENT_DETAILS = "detail";
    const REFILTER_EVENT_UPDATE_PICKER = "updateDatePicker";

    function DateFilterComponent() {}

    DateFilterComponent.prototype.init = function(params)
    {
        let that = this;
        this.params = params;
        this.gui = document.createElement("div");

        this.gui.classList.add("grid-container");
        this.gui.innerHTML = "<select>" +
                                "<option value='on'>On/in</option>" +
                                "<option value='after'>After</option>" +
                                "<option value='before'>Before</option>" +
                                "<option value='not'>Not on/in</option>" +
                                "<option value='between'>Between</option>" +
                             "</select>" +

                             "<div class='date-input-wrapper'>" +
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
                             "</div>";

        this.setupGuiHooks(params);
    }

    //
    // Does the main work of setting up the GUI's event handlers and hooks
    //
    DateFilterComponent.prototype.setupGuiHooks = function(params)
    {
        let dateInputWrappers = this.gui.querySelectorAll(".date-input-wrapper");
        for (let idx = 0; idx < dateInputWrappers.length; idx++)
        {
            let dateInputWrapper    = dateInputWrappers[idx];
            let dateInput           = dateInputWrapper.querySelector(".date-input");
            let launcherBtn         = dateInputWrapper.querySelector(".btn-date-launcher");
            let hiddenDateInput     = dateInputWrapper.querySelector(".hidden-date-input");

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
                                                raiseDateInputChange(dateInput, dateStr, false);
                                            }
                                        });

            // Ensure that clicking within the date picking widget is
            // interpreted as a selection within the customer filter component.
            datePicker.calendarContainer.classList.add("ag-custom-component-popup");

            // Set up the launcher button to launch the date picker
            launcherBtn.addEventListener("click", function() { datePicker.open(); });
        }

        this.filterType = this.gui.querySelector("select");
        this.filterType.addEventListener("change", filterTypeChanged);

        let clearButton = this.gui.querySelector(".btn-filter-clear");
        clearButton.addEventListener("click", clearDates);

        // Make a copy of the this pointer for use in following local functions
        let filterComp = this;

        // Sets the value of a date input, then raises a change event
        function raiseDateInputChange(dateInput, dateStr, updateDatePicker)
        {
            let changeEventDetails = {};
            changeEventDetails[REFILTER_EVENT_DETAILS] = {};
            changeEventDetails[REFILTER_EVENT_DETAILS][REFILTER_EVENT_UPDATE_PICKER] = false;
            let changeEvent = new CustomEvent(REFILTER_EVENT_TYPE, changeEventDetails);

            if (dateStr != null)
            {
                dateInput.value = dateStr;
            }
            dateInput.dispatchEvent(changeEvent);
        }

        // If required, synch the manual date input and date picker, then
        // recalculate the filter results
        function dateInputChanged(event)
        {
            let dateStr             = this.value;
            let dateComponents      = parseDateComponents(dateStr);
            let updateDatePicker    = true;

            // Temporary validation code (mark invalid date inputs in red)
            if (dateStr && !dateComponents)
            {
                this.style.setProperty("background-color", "red");
            }
            else
            {
                this.style.removeProperty("background-color");
            }

            // Check whether the picker should be updated
            let eventDetail = event[REFILTER_EVENT_DETAILS];
            if (eventDetail)
            {
                updateDatePicker = eventDetail[REFILTER_EVENT_UPDATE_PICKER];
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

        // Show/hide the end date input wrapper per the filter type.
        // Fire a date input change.
        function filterTypeChanged(event)
        {
            if (this.value == "between")
            {
                filterComp.gui.querySelector(".date-input-wrapper.end-date").hidden = false;
            }
            else
            {
                filterComp.gui.querySelector(".date-input-wrapper.end-date").hidden = true;
            }

            let dateInput = filterComp.gui.querySelector(".date-input")

            raiseDateInputChange(dateInput, null, false);
        }


        // Clear each of the date inputs
        function clearDates(event)
        {
            filterComp.gui.querySelectorAll(".date-input").forEach(function(dateInput)
                                                                  {
                                                                      raiseDateInputChange(dateInput, "", true);
                                                                  });
        }
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
            let rowDate = rowFilterParams.data[this.params.colDef.field];
            if (rowDate)
            {
                let filterType  = this.filterType.value;
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
        //TODO
        return null;
    }

    DateFilterComponent.prototype.setModel = function(model)
    {
        //TODO
    }

    return DateFilterComponent;
}
