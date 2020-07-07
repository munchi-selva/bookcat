//
// Date objects consist of year/date/day components (fields).
// When formatted as a string, they are separated by DATE_COMP_SEP
//
const DATE_COMP_YEAR    = "year";
const DATE_COMP_MONTH   = "month";
const DATE_COMP_DAY     = "day";
const DATE_COMP_SEP     = "-";

//
// Regular expressions and constants useful for date validation
//
const REGEX_YEAR    = new RegExp(/^[1-9][0-9]*$/);
const REGEX_MONTH   = new RegExp(/^(1[0-2]|0?[1-9])$/);
const REGEX_DAY     = new RegExp(/^(0?[1-9]|[1-2][0-9]|3[01])$/);
const YEAR_MIN      = 1;    // Not dealing with BCE items... :)
const MONTH_MIN     = 1;
const MONTH_MAX     = 12;
const STD_MONTH_LENGTHS =
{
    1:  31,
    2:  28,
    3:  31,
    4:  30,
    5:  31,
    6:  30,
    7:  31,
    8:  31,
    9:  30,
    10: 31,
    11: 30,
    12: 31
};
const FEB_LEAP_YEAR_DAYS = 29;


//
// Checks if a string is formatted as a date (possibly invalid)
//
function isDateString(candidateDateStr)
{
    let candidateDate = parseDate(candidateDateStr);
    return (candidateDate != null);
}

//
// Checks if a date is valid
//
function isDateValid(date)
{
    let valid = true;
    if (date)
    {
        valid = areDateCompsValid(date[DATE_COMP_YEAR],
                                  date[DATE_COMP_MONTH],
                                  date[DATE_COMP_DAY]);
    }
    return valid;
}

//
// Checks if a date, specified as year/month/day components, is valid
//
function areDateCompsValid(year, month, day)
{
    let valid = true;
    if (year)
    {
        valid = (year >= YEAR_MIN);
        if (valid && month)
        {
            valid = (month >= MONTH_MIN && month <= MONTH_MAX);
            if (valid && day)
            {
                let day_max = STD_MONTH_LENGTHS[month];
                // Special handling for February... bloody February
                if (month == 2 &&
                    (year % 400 == 0 ||
                        (year % 4 == 0 && year % 100 != 0)))
                {
                    day_max = FEB_LEAP_YEAR_DAYS;
                }
                valid = day <= day_max;
            }
        }
    }
    return valid;
}

//
// Parses a date string into its year/month/day components.
// If validation is requested, returns a null result if the date string
// represents an invalid date.
//
function parseDate(dateString, validate = true)
{
    let date = null;
    if (dateString)
    {
        let dateComponents = dateString.split(DATE_COMP_SEP);
        if (dateComponents.length > 0 && dateComponents.length <= 3)
        {
            let year = dateComponents.shift();
            let month = dateComponents.length > 0 ? dateComponents.shift() : null;
            let day = dateComponents.length > 0 ? dateComponents.shift() : null;

            if (REGEX_YEAR.test(year) &&
                (!month || REGEX_MONTH.test(month)) &&
                (!day || REGEX_DAY.test(day)))
            {
                let dateOkay = (!validate || isDateValid(parseInt(year), parseInt(month), parseInt(day)));
                if (dateOkay)
                {
                    date = {};
                    date[DATE_COMP_YEAR] = parseInt(year);
                    if (month)
                    {
                        date[DATE_COMP_MONTH] = parseInt(month);
                        if (day)
                        {
                            date[DATE_COMP_DAY] = parseInt(day);
                        }
                    }
                }
            }
        }
    }
    return date;
}

//
// Formats a date as a string
//
function getDateString(date)
{
    let dateString  = "";
    if (date)
    {
        dateString = getDateCompString(date[DATE_COMP_YEAR],
                                       date[DATE_COMP_MONTH],
                                       date[DATE_COMP_DAY]);
    }
    return dateString;
}

//
// Formats year, month and day components as a date string
//
function getDateCompString(year, month, day)
{
    let dateString = "";
    if (year)
    {
        dateString = year.toString();
        if (month)
        {
            dateString += DATE_COMP_SEP + (month < 10 ? "0" : "") + month.toString();

            if (day)
            {
                dateString += DATE_COMP_SEP + (day < 10 ? "0": "") + day.toString();
            }
        }
    }
    return dateString;
}

//
// Compares two dates represented in component form, with return values
// according to JavaScript array sort comparator conventions, i.e.
//  < 0 => refDate comes before compDate
//   0  => refDate is equal to (includes) compDate
//  > 0 => refDate comes after compDate
//
// The equals condition corresponds to the case where compDate is on/in
// refDate, so it can be met even if the dates do not have identical component
// values,
//      e.g. refDate {year: 2000} "equals"
//           compDate... {year: 2000},
//                       {year: 2000; month: 2},
//                       {year: 2000; month: 2; day: 20}, etc.
//
function compareDates(refDate, compDate)
{
    if (!refDate && !compDate)
    {
        return 0;
    }

    if (!refDate)
    {
        return -1;
    }

    if (!compDate)
    {
        return 1;
    }

    /////////////////////////////////////////////////////////////////
    //                                ||
    // Non-null refDate and compDate  ||
    //                                \/
    /////////////////////////////////////////////////////////////////

    let refYear = refDate[DATE_COMP_YEAR];
    let compYear = compDate[DATE_COMP_YEAR];

    if (refYear < compYear)
    {
        return -1
    }

    if (refYear > compYear)
    {
        return 1;
    }

    /////////////////////////////////////////////////////////////////
    //                      ||
    // refYear == compYear  ||
    //                      \/
    /////////////////////////////////////////////////////////////////

    let refMonth = refDate[DATE_COMP_MONTH];
    let compMonth = compDate[DATE_COMP_MONTH];

    if (!refMonth)
    {
        return 0;
    }

    if (!compMonth)
    {
        return 1;
    }

    if (refMonth < compMonth)
    {
        return -1;
    }

    if (refMonth > compMonth)
    {
        return 1;
    }

    /////////////////////////////////////////////////////////////////
    //                                               ||
    // refYear == compYear && refMonth == compMonth  ||
    //                                               \/
    /////////////////////////////////////////////////////////////////

    let refDay = refDate[DATE_COMP_DAY];
    let compDay = compDate[DATE_COMP_DAY];

    if (!refDay)
    {
        return 0;
    }

    if (!compDay)
    {
        return 1;
    }

    if (refDay < compDay)
    {
        return -1;
    }

    if (refDay > compDay)
    {
        return 1;
    }

    /////////////////////////////////////////////////////////////////
    // refYear == compYear, refMonth == compMonth, refDay == compDay
    /////////////////////////////////////////////////////////////////

    return 0;
}
