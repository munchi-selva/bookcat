//
// Parses a date string into its year/month/day components.
//
function parseDateComponents(dateString)
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
                if (isDateValid(parseInt(year), parseInt(month), parseInt(day)))
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
//  < 0 => refDate < compDate
//   0  => refDate == compDate
//  > 0 => refDate > compDate
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
