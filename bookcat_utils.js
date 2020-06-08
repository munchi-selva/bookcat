//
// Checks if a string is formatted as a date (possibly invalid)
//
function isDateString(candidateDateStr)
{
    let candidateDate = parseDateComponents(candidateDateStr);
    return (candidateDate != null);
}

//
// Checks if a date (specified as year, month, day values) is valid
//
function isDateValid(year, month, day)
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
function parseDateComponents(dateString, validate = true)
{
    let date = null;
    if (dateString)
    {
        let dateComponents = dateString.split(DATE_SEP);
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
                    date[CAT_FLD_DATE_YEAR] = parseInt(year);
                    if (month)
                    {
                        date[CAT_FLD_DATE_MONTH] = parseInt(month);
                        if (day)
                        {
                            date[CAT_FLD_DATE_DAY] = parseInt(day);
                        }
                    }
                }
            }
        }
    }
    return date;
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
function compareDateComponents(refDate, compDate)
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

    let refYear = refDate[CAT_FLD_DATE_YEAR];
    let compYear = compDate[CAT_FLD_DATE_YEAR];

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

    let refMonth = refDate[CAT_FLD_DATE_MONTH];
    let compMonth = compDate[CAT_FLD_DATE_MONTH];

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

    let refDay = refDate[CAT_FLD_DATE_DAY];
    let compDay = compDate[CAT_FLD_DATE_DAY];

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
