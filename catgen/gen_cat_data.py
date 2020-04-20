#!/usr/bin/env python3
# -*- coding: utf-8 -*-

################################################################################
# Utility for converting between miscellaneous representations of a book
# catalogue, and importing data from the openlib database.
# "Flat" catalogues are either Excel or TSV files.
# "Mapped" catalogues use a JSON format.
################################################################################

################################################################################
# Imports
################################################################################
import argparse
import itertools
import re
import json
import pycurl
import sys
from collections import namedtuple
from enum import IntEnum
from io import BytesIO
from openpyxl import load_workbook
from os import path
from typing import Dict, List


###############################################################################
# Input catalogue handling
###############################################################################
TSV_HEADER_LINES    = 4
TSV_ROW_OFFSET      = TSV_HEADER_LINES
TSV_BASE_ROW        = TSV_ROW_OFFSET + 1


###############################################################################
# Miscellaneous
###############################################################################
DATE_SEP            = '-'
NAME_SEP            = ';'
IGNORED_SEP         = ';'

# Unit conversion
IN_TO_CM            = 2.54
LB_TO_OZ            = 16
OZ_TO_KG            = 0.028
LB_TO_KG            = LB_TO_OZ * OZ_TO_KG

DIM_HEIGHT_IDX      = 0
DIM_WIDTH_IDX       = 1
DIM_THICKNESS_IDX   = 2

CAT_FILE_PREFIX         = 'Books'
CAT_FILE_INTER_SUFFIX   = 'icat'
CAT_FILE_SUFFIX         = 'cat'

###############################################################################
# ISBN handling
###############################################################################
# For check digit calculations
ISBN10_DIGITS               = 10
ISBN10_MAX_DIGIT_WEIGHT     = 10
ISBN10_MOD_FACTOR           = 11
ISBN13_MOD_FACTOR           = 10

ISBN13_DIGITS               = 13
ISBN13_PREFIX               = '978'

RE_ISBN10_NO_CHECK  = '\d{9}'
RE_ISBN10_FULL      = RE_ISBN10_NO_CHECK + '(\d|X)' 
RE_ISBN13_NO_CHECK  = ISBN13_PREFIX + RE_ISBN10_NO_CHECK
RE_ISBN13_FULL      = RE_ISBN13_NO_CHECK + '(\d|X)'

###############################################################################
# Open library JSON keys
###############################################################################
OLK_DETAILS         = 'details'
OLK_AUTHORS         = 'authors'
OLK_AUTHOR_NAME     = 'name'
OLK_IDENTIFIERS     = 'identifiers'
OLK_ISBN13          = 'isbn_13'
OLK_ISBN10          = 'isbn_10'
OLK_KEY             = 'key'
OLK_FORMAT          = 'physical_format'
OLK_DIMENSIONS      = 'physical_dimensions'
OLK_WEIGHT          = 'weight'
OLK_PAGES           = 'number_of_pages'
OLK_PUBLISHERS      = 'publishers'
OLK_PUBLISH_PLACES  = 'publish_places'
OLK_PUBLISH_DATE    = 'publish_date'
OLK_SUBTITLE        = 'subtitle'
OLK_TITLE           = 'title'
OLK_URL             = 'info_url'

###############################################################################
# Book catalogue JSON keys
###############################################################################
BCK_ID              = 'id'
BCK_AUTHORS         = OLK_AUTHORS
BCK_PUBLISHERS      = OLK_PUBLISHERS
BCK_TITLE           = OLK_TITLE
BCK_PURCHASE_DATE   = 'purchase_date'
BCK_ARRIVAL_DATE    = 'arrival_date'
BCK_DATE_YEAR       = 'year'
BCK_DATE_MONTH      = 'month'
BCK_DATE_DAY        = 'day'
BCK_NUM_IN_ORDER    = 'number_in_order'
BCK_SELLER          = 'seller'
BCK_SELLER_BRANCH   = 'seller_branch'
BCK_PURCHASER       = 'purchaser'
BCK_PURCHASE_PRICE  = 'purchase_price'
BCK_SHIPPING_PRICE  = 'shipping_price'
BCK_CURRENCY        = 'purchase_currency'
BCK_CURR_CONV       = 'price_conversion_rate'
BCK_ELEC_FORMAT     = 'electronic_format'

BCK_DIM             = 'dimensions'
BCK_DIM_HEIGHT      = 'height'
BCK_DIM_WIDTH       = 'width'
BCK_DIM_THICKNESS   = 'thickness'
BCK_DIM_LENGTH      = 'length'
BCK_DIM_MASS        = 'mass'
BCK_DIM_MASS_UNITS  = 'mass_units'

BCK_COVER_REQUIRED  = 'cover_required'
BCK_LOCATION        = 'location'
BCK_NOTES           = 'notes'

BCK_IGNORED         = 'ignored_fields'

BCK_FLAGS           = 'flags'
BCK_FLAG_BIT_OPENLIB_SYNCED = 0
BCK_FLAG_BIT_IN_OPENLIB     = 1
BCK_FLAG_BIT_INVALID_ISBN13 = 2
BCK_FLAG_BIT_INVALID_ISBN10 = 3

# Sources of data
BCK_SRC_OPENLIB         = 'openlib'
BCK_SRC_AMAZON          = 'amazon'




###############################################################################
def prettyPrint(json_obj):
    """
    Outputs a JSON object with human-friendly formatting

    :param json_obj: The JSON object
    :returns: None
    """
    print(json.dumps(json_obj, sort_keys = True, indent = 4))
###############################################################################


###############################################################################
def getNames(full_name, given_names):
    """
    Extracts given and surnames from a name string

    :param full_name: The full name
    :returns: None
    """
    names = full_name.split()
    given_names.extend(names[:len(names)-1])
    return (names[-1] if names else '')
###############################################################################


###############################################################################
def parseNames(name_string):
    return name_string.split(NAME_SEP) if name_string else None
###############################################################################


###########################################################################
def parseDimensions(dim_string: str):
    height = width = thickness = None

    if dim_string:
        dims = re.split('\s+x\s+|\s+\w+', dim_string)
        if len(dims) == 4:
            height      = round(float(dims[DIM_HEIGHT_IDX]) * IN_TO_CM, 2)
            width       = round(float(dims[DIM_WIDTH_IDX]) * IN_TO_CM, 2)
            thickness   = round(float(dims[DIM_THICKNESS_IDX]) * IN_TO_CM, 2)

    return height, width, thickness
###############################################################################


###############################################################################
def popMappedRec(mapped_rec: dict,
                    verbose: bool = False):
    """
    Populates a mapped catalogue record with its OpenLibrary details

    :param mapped_rec: Catalogue record represented as a dictionary/JSON object
    :returns: None
    """
    if getMappedRecFlag(mapped_rec, BCK_FLAG_BIT_OPENLIB_SYNCED):
        # Already up to date, don't query openlib
        print("Record {} already up to date, no need to populate".format(getMappedRecFld(mapped_rec, BCK_ID)))
        return

    isbn13 = mapped_rec.get(OLK_ISBN13, None)
    isbn10 = mapped_rec.get(OLK_ISBN10, None)

    if not isbn13:
        # Nothing to search with...
        print("No ISBN13, cannot populate record")
        setMappedRecFlag(mapped_rec, BCK_FLAG_BIT_OPENLIB_SYNCED)
        return

    if not isValidISBN(isbn10):
        setMappedRecFlag(mapped_rec, BCK_FLAG_BIT_INVALID_ISBN10)

    if not isValidISBN(isbn13):
        print("ISBN13 '{}' is invalid, skipping record population".format(isbn13))
        # Should be redundant
        setMappedRecFlag(mapped_rec, BCK_FLAG_BIT_OPENLIB_SYNCED)
        setMappedRecFlag(mapped_rec, BCK_FLAG_BIT_INVALID_ISBN13)
        return

    # Retrieve OpenLibrary record
    isbn_key = 'ISBN:' + mapped_rec[OLK_ISBN13]
    openlib_url = 'https://openlibrary.org/api/books?bibkeys=' + isbn_key + '&jscmd=details&format=json'
    buffer = BytesIO()
    c = pycurl.Curl()
    c.setopt(c.URL, openlib_url)
    c.setopt(c.WRITEFUNCTION, buffer.write)
    c.setopt(c.SSL_VERIFYPEER, 0)
    c.setopt(c.SSL_VERIFYHOST, 0)
    c.setopt(c.WRITEDATA, buffer)
    record_retrieved = False
    while not record_retrieved:
        try:
            c.perform()
            record_retrieved = True
        except:
            print("Retrying retrieval")
    c.close()

    openlib_result = (buffer.getvalue()).decode("utf-8")
    empty_record = '{}'
    if (openlib_result == empty_record):
        # No OpenLibrary record available
        print("No openlib record for ISBN {}".format(isbn13))
        setMappedRecFlag(mapped_rec, BCK_FLAG_BIT_OPENLIB_SYNCED)
        return

    openlib_record = json.loads(openlib_result)[isbn_key]
    if verbose:
        prettyPrint(openlib_record)

    ignored_fields = mapped_rec.get(BCK_IGNORED, [])

    if OLK_AUTHORS not in ignored_fields and OLK_AUTHORS in openlib_record[OLK_DETAILS].keys():
        openlib_authors = []
        for author_rec in openlib_record[OLK_DETAILS][OLK_AUTHORS]:
            author_string = author_rec[OLK_AUTHOR_NAME]
            given_names = [];
            surname = getNames(author_string, given_names)
            openlib_author = {}
            openlib_author['given_names']   = given_names
            openlib_author['surname']       = surname
            openlib_authors.append(openlib_author)
        setMappedRecFld(mapped_rec, [BCK_SRC_OPENLIB, OLK_AUTHORS], openlib_authors)

    #if OLK_ISBN10 in openlib_record[OLK_DETAILS].keys():
        #mapped_rec[OLK_ISBN10] = openlib_record[OLK_DETAILS][OLK_ISBN10][0]


    #
    # Process dimensions, length and mass
    #
    openlib_dim = {}
    if OLK_DIMENSIONS in openlib_record[OLK_DETAILS].keys():
        height, width, thickness = parseDimensions(openlib_record[OLK_DETAILS][OLK_DIMENSIONS])
        openlib_dim[BCK_DIM_HEIGHT] = height
        openlib_dim[BCK_DIM_WIDTH]  = width
        openlib_dim[BCK_DIM_THICKNESS] = thickness

    if OLK_PAGES in openlib_record[OLK_DETAILS].keys():
        openlib_dim[BCK_DIM_LENGTH] = openlib_record[OLK_DETAILS][OLK_PAGES]

    if OLK_WEIGHT in openlib_record[OLK_DETAILS].keys():
        openlib_mass_str = openlib_record[OLK_DETAILS][OLK_WEIGHT]
        openlib_mass_match = re.search(r'\d+([.]\d+)?', openlib_mass_str)
        if openlib_mass_match:
            openlib_dim[BCK_DIM_MASS] = float(openlib_mass_match.group(0))

        openlib_mass_units_match = re.search(r'[a-z]+', openlib_mass_str)
        if openlib_mass_units_match:
            openlib_dim[BCK_DIM_MASS_UNITS] = openlib_mass_units_match.group(0)

        #openlib_dim[BCK_DIM_MASS] = openlib_record[OLK_DETAILS][OLK_WEIGHT]

    setMappedRecFld(mapped_rec, [BCK_SRC_OPENLIB, BCK_DIM], openlib_dim)

    for subkey in [OLK_FORMAT, OLK_KEY, OLK_PUBLISHERS, OLK_PUBLISH_PLACES, OLK_PUBLISH_DATE, OLK_SUBTITLE, OLK_TITLE]:
        #if subkey not in ignored_fields and subkey in openlib_record[OLK_DETAILS].keys():
        if subkey in openlib_record[OLK_DETAILS].keys():
            setMappedRecFld(mapped_rec, [BCK_SRC_OPENLIB, subkey], openlib_record[OLK_DETAILS][subkey])

    #if OLK_URL not in ignored_fields and OLK_URL in openlib_record.keys():
    if OLK_URL in openlib_record.keys():
        setMappedRecFld(mapped_rec, [BCK_SRC_OPENLIB, OLK_URL], openlib_record[OLK_URL])

    setMappedRecFlag(mapped_rec, BCK_FLAG_BIT_OPENLIB_SYNCED)
###############################################################################


###############################################################################
def popMappedRecs(mapped_recs: dict,
                     output_cat_filename: str = None,
                     verbose: bool = False):
    for mapped_rec in mapped_recs:
        popMappedRec(mapped_rec, verbose)
        if BCK_SRC_OPENLIB in mapped_rec.keys() and OLK_TITLE in mapped_rec[BCK_SRC_OPENLIB].keys():
            setMappedRecFlag(mapped_rec, BCK_FLAG_BIT_IN_OPENLIB)
            print('ISBN {} matches OpenLibrary title:\n\t{}'.format(mapped_rec[OLK_ISBN13], mapped_rec[OLK_TITLE]))

    if verbose:
        for mapped_rec in mapped_recs:
            prettyPrint(mapped_rec)

    if output_cat_filename is not None:
        file_flags = 'w'
        with open(output_cat_filename, file_flags) as output_cat_file:
            json.dump(mapped_recs, output_cat_file, indent = 4)
###############################################################################


###############################################################################
# Catalogue file types enum
###############################################################################
CatType = IntEnum('CatType',    'CT_NONE    \
                                 CT_EXCEL   \
                                 CT_TSV     \
                                 CT_JSON    \
                                 CT_COUNT',

                                 start = -1)
###############################################################################


###############################################################################
# Flat record columns enum
###############################################################################
CatCol   = IntEnum('CatCol',  'CC_ID                        \
                               CC_PURCH_DAY                 \
                               CC_PURCH_MON                 \
                               CC_PURCH_YEAR                \
                               CC_ARRIVAL_DAY               \
                               CC_ARRIVAL_MON               \
                               CC_ARRIVAL_YEAR              \
                               CC_NUM_IN_ORDER              \
                               CC_ISBN13                    \
                               CC_ISBN10                    \
                               CC_SURNAME                   \
                               CC_GIVEN_NAMES               \
                               CC_TITLE                     \
                               CC_PUBLISHER                 \
                               CC_SELLER                    \
                               CC_SELLER_BRANCH             \
                               CC_PURCHASER                 \
                               CC_PRICE                     \
                               CC_SHIPPING                  \
                               CC_CURRENCY                  \
                               CC_CONVERSION                \
                               CC_TOTAL                     \
                               CC_LENGTH_AM                 \
                               CC_HEIGHT_AM_IN              \
                               CC_WIDTH_AM_IN               \
                               CC_THICKNESS_AM_IN           \
                               CC_MASS_AM_OZ                \
                               CC_MASS_AM_LB                \
                               CC_HEIGHT_AM_CM              \
                               CC_WIDTH_AM_CM               \
                               CC_THICKNESS_AM_CM           \
                               CC_MASS_AM_KG                \
                               CC_LENGTH_ACT                \
                               CC_HEIGHT_ACT                \
                               CC_WIDTH_ACT                 \
                               CC_THICKNESS_ACT             \
                               CC_MASS_ACT_KG               \
                               CC_ELECTRONIC_DOWNLOAD_DATE  \
                               CC_ELECTRONIC_FORMAT         \
                               CC_COVER_REQ                 \
                               CC_LOCATION                  \
                               CC_NOTES                     \
                               CC_IGNORED                   \
                               CC_COUNT',

                               start = 0
                               )
###############################################################################


###############################################################################
# Catalogue field data types enum
###############################################################################
CatFldType = IntEnum('CatFldType', 'CFT_STRING \
                                    CFT_INT    \
                                    CFT_FLOAT  \
                                    CFT_CURR   \
                                    CFT_COUNT',

                                    start = 0
                                    )
###############################################################################


###############################################################################
def getFlatRecFld(flat_rec:     list,
                  item_id:      int,
                  type:         CatFldType = CatFldType.CFT_STRING):
    """
    Retrieves a field from a flat catalogue record

    :param flat_rec:    The catalogue record represented as a list of items
    :param item_id:     ID of the required field
    :param type:        Required data type of the field
    :returns:           The catalogue record field value
    """
    if item_id < len(flat_rec) and flat_rec[item_id]:
        if type == CatFldType.CFT_INT:
            return int(flat_rec[item_id])
        elif type == CatFldType.CFT_FLOAT:
            return float(flat_rec[item_id])
        elif type == CatFldType.CFT_CURR:
            return round(float(flat_rec[item_id]), 2)
        return flat_rec[item_id]

    return None
###############################################################################


###############################################################################
def flatToMappedRec(flat_rec: list,
                    mapped_rec: dict):
    """
    Converts a flat catalogue entry to a mapped catalogue record

    :param flat_rec:    Flat catalogue record
    :param mapped_rec:  The equivalent mapped catalogue record
    :returns:           None
    """
    rec_id          = getFlatRecFld(flat_rec, CatCol.CC_ID, CatFldType.CFT_INT)

    purch_day       = getFlatRecFld(flat_rec, CatCol.CC_PURCH_DAY)  # TODO: Change to integer type
    purch_month     = getFlatRecFld(flat_rec, CatCol.CC_PURCH_MON)
    purch_year      = getFlatRecFld(flat_rec, CatCol.CC_PURCH_YEAR)

    arrival_day     = getFlatRecFld(flat_rec, CatCol.CC_ARRIVAL_DAY)
    arrival_month   = getFlatRecFld(flat_rec, CatCol.CC_ARRIVAL_MON)
    arrival_year    = getFlatRecFld(flat_rec, CatCol.CC_ARRIVAL_YEAR)

    number_in_order = getFlatRecFld(flat_rec, CatCol.CC_NUM_IN_ORDER, CatFldType.CFT_INT)

    isbn13          = getFlatRecFld(flat_rec, CatCol.CC_ISBN13)
    isbn10          = getFlatRecFld(flat_rec, CatCol.CC_ISBN10)
    if not isbn13 and isbn10 and isValidISBN(isbn10):
        isbn13 = convISBN(isbn10, ISBN13_DIGITS)
    if not isbn10 and isbn13 and isValidISBN(isbn13):
        isbn10 = convISBN(isbn13, ISBN10_DIGITS)

    surnames        = parseNames(getFlatRecFld(flat_rec, CatCol.CC_SURNAME))
    given_names     = parseNames(getFlatRecFld(flat_rec, CatCol.CC_GIVEN_NAMES))
    title           = getFlatRecFld(flat_rec, CatCol.CC_TITLE)
    publisher       = getFlatRecFld(flat_rec, CatCol.CC_PUBLISHER)

    seller          = getFlatRecFld(flat_rec, CatCol.CC_SELLER)
    seller_branch   = getFlatRecFld(flat_rec, CatCol.CC_SELLER_BRANCH)
    purchaser       = getFlatRecFld(flat_rec, CatCol.CC_PURCHASER)
    price           = getFlatRecFld(flat_rec, CatCol.CC_PRICE, CatFldType.CFT_CURR)
    shipping        = getFlatRecFld(flat_rec, CatCol.CC_SHIPPING, CatFldType.CFT_CURR)
    currency        = getFlatRecFld(flat_rec, CatCol.CC_CURRENCY)
    conversion      = getFlatRecFld(flat_rec, CatCol.CC_CONVERSION, CatFldType.CFT_FLOAT)

    length_am       = getFlatRecFld(flat_rec, CatCol.CC_LENGTH_AM, CatFldType.CFT_FLOAT)
    height_am       = getFlatRecFld(flat_rec, CatCol.CC_HEIGHT_AM_CM, CatFldType.CFT_FLOAT)
    width_am        = getFlatRecFld(flat_rec, CatCol.CC_WIDTH_AM_CM, CatFldType.CFT_FLOAT)
    thickness_am    = getFlatRecFld(flat_rec, CatCol.CC_THICKNESS_AM_CM, CatFldType.CFT_FLOAT)
    mass_am_lb      = getFlatRecFld(flat_rec, CatCol.CC_MASS_AM_LB, CatFldType.CFT_FLOAT)
    mass_am_oz      = getFlatRecFld(flat_rec, CatCol.CC_MASS_AM_OZ, CatFldType.CFT_FLOAT)

    mass_am         = 0
    if mass_am_lb:
        mass_am += mass_am_lb * LB_TO_KG
    if mass_am_oz:
        mass_am += mass_am_oz * OZ_TO_KG

    length_act      = getFlatRecFld(flat_rec, CatCol.CC_LENGTH_ACT, CatFldType.CFT_FLOAT)
    height_act      = getFlatRecFld(flat_rec, CatCol.CC_HEIGHT_ACT, CatFldType.CFT_FLOAT)
    width_act       = getFlatRecFld(flat_rec, CatCol.CC_WIDTH_ACT, CatFldType.CFT_FLOAT)
    thickness_act   = getFlatRecFld(flat_rec, CatCol.CC_THICKNESS_ACT, CatFldType.CFT_FLOAT)
    mass_act        = getFlatRecFld(flat_rec, CatCol.CC_MASS_ACT_KG, CatFldType.CFT_FLOAT)

    electronic_fmt  = getFlatRecFld(flat_rec, CatCol.CC_ELECTRONIC_FORMAT)
    cover_required  = getFlatRecFld(flat_rec, CatCol.CC_COVER_REQ)
    location        = getFlatRecFld(flat_rec, CatCol.CC_LOCATION)
    notes           = getFlatRecFld(flat_rec, CatCol.CC_NOTES)

    ignored_fields_string = getFlatRecFld(flat_rec, CatCol.CC_IGNORED)

    setMappedRecFld(mapped_rec, [OLK_ISBN13], isbn13)
    setMappedRecFld(mapped_rec, [OLK_ISBN10], isbn10)
    setMappedRecFld(mapped_rec, [BCK_FLAGS], 0, True)
    if isbn13 and not isValidISBN(isbn13):
        setMappedRecFlag(mapped_rec, BCK_FLAG_BIT_INVALID_ISBN13)
    if isbn10 and not isValidISBN(isbn10):
        setMappedRecFlag(mapped_rec, BCK_FLAG_BIT_INVALID_ISBN10)

    if surnames or given_names:
        authors = []
        sur = surnames if surnames else []
        giv = given_names if given_names else []
        for surname, given in itertools.zip_longest(sur, giv):
            authors.append({'surname': surname, 'given_names': [given] if giv else []})
        setMappedRecFld(mapped_rec, [BCK_AUTHORS], authors)

    setMappedRecFld(mapped_rec, [BCK_TITLE], title)

    if publisher:
        setMappedRecFld(mapped_rec, [BCK_PUBLISHERS], [publisher])

    setMappedRecFld(mapped_rec, [BCK_ID], rec_id)

    setMappedRecFld(mapped_rec, [BCK_PURCHASE_DATE, BCK_DATE_YEAR], purch_year)
    setMappedRecFld(mapped_rec, [BCK_PURCHASE_DATE, BCK_DATE_MONTH], purch_month)
    setMappedRecFld(mapped_rec, [BCK_PURCHASE_DATE, BCK_DATE_DAY], purch_day)
    setMappedRecFld(mapped_rec, [BCK_ARRIVAL_DATE, BCK_DATE_YEAR], arrival_year)
    setMappedRecFld(mapped_rec, [BCK_ARRIVAL_DATE, BCK_DATE_MONTH], arrival_month)
    setMappedRecFld(mapped_rec, [BCK_ARRIVAL_DATE, BCK_DATE_DAY], arrival_day)

    setMappedRecFld(mapped_rec, [BCK_NUM_IN_ORDER], number_in_order)
    setMappedRecFld(mapped_rec, [BCK_PURCHASE_PRICE], price)
    setMappedRecFld(mapped_rec, [BCK_SHIPPING_PRICE], shipping)
    setMappedRecFld(mapped_rec, [BCK_CURRENCY], currency)
    setMappedRecFld(mapped_rec, [BCK_CURR_CONV], conversion)
    setMappedRecFld(mapped_rec, [BCK_SELLER], seller)
    setMappedRecFld(mapped_rec, [BCK_SELLER_BRANCH], seller_branch)
    setMappedRecFld(mapped_rec, [BCK_PURCHASER], purchaser)

    setMappedRecFld(mapped_rec, [BCK_DIM, BCK_DIM_HEIGHT],      height_act)
    setMappedRecFld(mapped_rec, [BCK_DIM, BCK_DIM_WIDTH],       width_act)
    setMappedRecFld(mapped_rec, [BCK_DIM, BCK_DIM_THICKNESS],   thickness_act)
    setMappedRecFld(mapped_rec, [BCK_DIM, BCK_DIM_LENGTH],      length_act)
    setMappedRecFld(mapped_rec, [BCK_DIM, BCK_DIM_MASS],        mass_act)


    am_dim = {}
    if height_am:
        am_dim[BCK_DIM_HEIGHT] = height_am;
    if width_am:
        am_dim[BCK_DIM_WIDTH] = width_am;
    if thickness_am:
        am_dim[BCK_DIM_THICKNESS] = thickness_am;
    if length_am:
        am_dim[BCK_DIM_LENGTH] = length_am;
    if mass_am:
        am_dim[BCK_DIM_MASS] = round(mass_am, 2)
    setMappedRecFld(mapped_rec, [BCK_SRC_AMAZON, BCK_DIM], am_dim)

    setMappedRecFld(mapped_rec, [BCK_ELEC_FORMAT], electronic_fmt)
    setMappedRecFld(mapped_rec, [BCK_COVER_REQUIRED], cover_required)
    setMappedRecFld(mapped_rec, [BCK_LOCATION], location)
    setMappedRecFld(mapped_rec, [BCK_NOTES], notes)

    if ignored_fields_string:
        setMappedRecFld(mapped_rec, [BCK_IGNORED], ignored_fields_string.split(IGNORED_SEP))

    prettyPrint(mapped_rec)
###############################################################################


###############################################################################
def setMappedRecFld(mapped_rec, key_chain, value, force: bool = False):
    """
    Sets the value of a record field
    e.g. key_chain = ["openlib", "dimensions", "length"], value = 5
         mapped_rec["openlib"]["dimensions"]["length"] =  5

    :param mapped_rec:  Catalogue record represented as a dictionary/JSON object
    :param key_chain:   The chain of key values that lead to the required field,
    :param value:       The value for the field
    :param force:       If true, set the field even if the specified value is a
                        null value (empty string, 0, etc.)
    :returns: None
    """
    if value or force:
        sub_rec = mapped_rec
        for key in key_chain[:-1]:
            # Navigate to the sub-record that hosts the ultimate key
            if key not in sub_rec:
                # Initialise a dictionary if the sub-record doesn't yet have
                # the latest key
                sub_rec[key] = {}
            sub_rec = sub_rec[key]
        sub_rec[key_chain[-1]] = value
###############################################################################


###############################################################################
def getMappedRecFlag(record, flag_position):
    flags = record.get(BCK_FLAGS, 0)
    return flags & (1 << flag_position)
###############################################################################


###############################################################################
def setMappedRecFlag(record, flag_position):
    flags = record.get(BCK_FLAGS, 0)
    flags |= (1 << flag_position)
    setMappedRecFld(record, [BCK_FLAGS], flags, True)
###############################################################################


###############################################################################
def getMappedRecFld(mapped_rec, key):
    """
    Retrieves a field from a mapped catalogue record

    :param mapped_rec:  Catalogue record represented as a dictionary/JSON object
    :param key:         Field to return
    :returns: The requested field if it exists, otherwise an empty string
    """
    return mapped_rec.get(key, '')
###############################################################################


###############################################################################
def getInterFilename(output_filename: str):
    filename_root, _ = path.splitext(output_filename)
    return '{}.{}'.format(filename_root, CAT_FILE_INTER_SUFFIX)
###############################################################################


###############################################################################
def flatToMappedCat(input_cat_file,
                   first_record:        int,
                   last_record:         int,
                   output_filename:     str,
                   inter_filename:      str     = None,
                   verbose:             bool    = False,
                   populate:            bool    = False):
    """
    Converts records of a flat (TSV) catalogue to a mapped catalogue file

    :param input_cat_file:  Access to the TSV catalogue file
    :param first_record:    First flat record to convert
    :param last_record:     Last flat record to convert
    :param output_filename: Target mapped catalogue file     
    :param inter_filename:  Intermediate catalogue file
    :param verbose:         If true, output extra debugging information
    :param populate:        If true, populate the converted records with openlib data

    :returns:   None
    """

    #
    # Convert record numbers to physical row/line numbers
    #
    first_row   = TSV_BASE_ROW if first_record == -1    else first_record + TSV_ROW_OFFSET
    last_row    = -1           if last_record == -1     else last_record + TSV_ROW_OFFSET

    #
    # Used to track position in the flat catalogue
    curr_row    = 1
    last_row_reached = False

    mapped_recs = []

    #
    # Move to the first row
    #
    input_cat_file.seek(0)
    while (not last_row_reached) and (curr_row < first_row):
        last_row_reached = not input_cat_file.readline()
        curr_row += 1

    while (not last_row_reached) and (last_row < 0 or curr_row <= last_row):
        flat_cat_line    = input_cat_file.readline()
        last_row_reached = not flat_cat_line

        flat_rec = flat_cat_line.split('\t')
        mapped_rec = {}
        flatToMappedRec(flat_rec, mapped_rec)
        mapped_recs.append(mapped_rec)
        curr_row += 1

    if inter_filename:
        with open(inter_filename, 'w') as inter_cat_file:
            json.dump(mapped_recs, inter_cat_file, indent = 4)

    if populate:
        popMappedRecs(mapped_recs, output_filename, verbose)
###############################################################################


###############################################################################
def mappedToFlatRec(mapped_rec: dict,
                    verbose:    bool = True):
    """
    Converts a mapped to a flat catalogue record

    :param mapped_rec: Catalogue record represented as a dictionary/JSON object
    :returns: Catalogue record represented as a list
    """

    # Initialise flat record to accommodate all fields
    flat_rec = list()
    for index in range(CatCol.CC_COUNT):
        flat_rec.append('')

    rec_id          = getMappedRecFld(mapped_rec, BCK_ID)
    purchase_date   = getMappedRecFld(mapped_rec, BCK_PURCHASE_DATE)
    arrival_date    = getMappedRecFld(mapped_rec, BCK_ARRIVAL_DATE)
    number_in_order = getMappedRecFld(mapped_rec, BCK_NUM_IN_ORDER)
    isbn_13         = getMappedRecFld(mapped_rec, OLK_ISBN13)
    isbn_10         = getMappedRecFld(mapped_rec, OLK_ISBN10)
    authors         = getMappedRecFld(mapped_rec, BCK_AUTHORS)
    title           = getMappedRecFld(mapped_rec, BCK_TITLE)
    publishers      = getMappedRecFld(mapped_rec, BCK_PUBLISHERS)
    purchase_price  = getMappedRecFld(mapped_rec, BCK_PURCHASE_PRICE)
    shipping_price  = getMappedRecFld(mapped_rec, BCK_SHIPPING_PRICE)
    conversion      = getMappedRecFld(mapped_rec, BCK_CURR_CONV)
    currency        = getMappedRecFld(mapped_rec, BCK_CURRENCY)
    seller          = getMappedRecFld(mapped_rec, BCK_SELLER)
    seller_branch   = getMappedRecFld(mapped_rec, BCK_SELLER_BRANCH)
    cover_required  = getMappedRecFld(mapped_rec, BCK_COVER_REQUIRED)

    flat_rec[CatCol.CC_ID] = rec_id

    # Split date strings into date components
    if purchase_date:
        flat_rec[CatCol.CC_PURCH_YEAR] = purchase_date.get(BCK_DATE_YEAR, '')
        flat_rec[CatCol.CC_PURCH_MON] = purchase_date.get(BCK_DATE_MONTH, '')
        flat_rec[CatCol.CC_PURCH_DAY] = purchase_date.get(BCK_DATE_DAY, '')

    if arrival_date:
        flat_rec[CatCol.CC_ARRIVAL_YEAR] = arrival_date.get(BCK_DATE_YEAR, '')
        flat_rec[CatCol.CC_ARRIVAL_MON] = arrival_date.get(BCK_DATE_MONTH, '')
        flat_rec[CatCol.CC_ARRIVAL_DAY] = arrival_date.get(BCK_DATE_DAY, '')

    if authors:
        surnames = [author.get('surname', '') for author in authors]
        given_names = [' '.join(author.get('given_names', [])) for author in authors]
        flat_rec[CatCol.CC_SURNAME]       = NAME_SEP.join(surnames)
        flat_rec[CatCol.CC_GIVEN_NAMES]   = NAME_SEP.join(given_names)

    flat_rec[CatCol.CC_TITLE] = title

    if publishers:
        flat_rec[CatCol.CC_PUBLISHER] = NAME_SEP.join(publishers)

    flat_rec[CatCol.CC_NUM_IN_ORDER]    = number_in_order
    flat_rec[CatCol.CC_ISBN13]          = isbn_13
    flat_rec[CatCol.CC_ISBN10]          = isbn_10
    flat_rec[CatCol.CC_PRICE]           = str(purchase_price)
    flat_rec[CatCol.CC_SHIPPING]        = str(shipping_price)
    flat_rec[CatCol.CC_CONVERSION]      = conversion
    flat_rec[CatCol.CC_CURRENCY]        = currency
    flat_rec[CatCol.CC_SELLER]          = seller
    flat_rec[CatCol.CC_SELLER_BRANCH]   = seller_branch
    flat_rec[CatCol.CC_COVER_REQ]       = cover_required

    # Generate a tab-separated version of the flat record
    return '\t'.join(flat_rec)
###############################################################################


###############################################################################
def calcISBNCheckDigit(isbn: str):
    """
    Converts a mapped to a flat catalogue record

    :param isbn: A string potentially representing an ISBN
    :returns: The check digit of the ISBN
    """
    check = -1
    if re.fullmatch(RE_ISBN10_NO_CHECK, isbn):
        check = 0
        for index, digit in enumerate(isbn):
            check += (ISBN10_MAX_DIGIT_WEIGHT - index) * int(digit)
        check %= ISBN10_MOD_FACTOR
        if check > 0:
            check = ISBN10_MOD_FACTOR - check
        return str(check) if check < 10 else 'X'
    elif re.fullmatch(RE_ISBN13_NO_CHECK, isbn):
        check = 0
        for index, digit in enumerate(isbn):
            if index % 2 == 0:
                check += int(digit)
            else:
                check += 3 * int(digit)
        check = ISBN13_MOD_FACTOR - check % ISBN13_MOD_FACTOR
        return str(check) if check < 10 else '0'
###############################################################################


###############################################################################
def isValidISBN(isbn: str):
    """
    Tests whether a string is a valid ISBN

    :param isbn: A string potentially representing an ISBN
    :returns: True if isbn is a valid ISBN
    """
    is_valid = False
    if re.fullmatch(RE_ISBN10_FULL, isbn) or re.fullmatch(RE_ISBN13_FULL, isbn):
        check_digit = calcISBNCheckDigit(isbn[:len(isbn)-1])
        return check_digit == isbn[-1]
    return is_valid
###############################################################################


###############################################################################
def convISBN(isbn: str,
             digits: int = ISBN13_DIGITS):
    """
    Converts a string (potentially an ISBN) into an equivalent ISBN with the
    specified number od digits

    :param isbn: A string potentially representing an ISBN
    :param digits: The number of digits in the converted ISBN
    :returns: The converted ISBN, or an empty string if the requested digit count was invalid
    """
    isbn_conv = ''
    if digits != ISBN10_DIGITS and digits != ISBN13_DIGITS:
        return isbn_conv
    if digits == len(isbn):
        isbn_conv = isbn
    else:
        if re.fullmatch(RE_ISBN10_FULL, isbn) and digits == ISBN13_DIGITS:
            isbn_conv = ISBN13_PREFIX + isbn[:len(isbn)-1]
        else:
            isbn_conv = isbn[len(ISBN13_PREFIX):len(isbn)-1]
        isbn_conv = isbn_conv + calcISBNCheckDigit(isbn_conv)
    return isbn_conv
###############################################################################


###############################################################################
def main():
    """
    TODO

    :returns: None
    """

#   for isbn in ['9781788160604', '9781585423187', '9780393344516', '9780330354912', '9781509828050', '9781471161285', '9781474235549', '9780385683715']:
#       if isValidISBN(isbn):
#           check = calcISBNCheckDigit(isbn[:12])
#           print(isbn[-1], check)
#       else:
#           print("'{}' is not a valid ISBN".format(isbn))

#   return

    # Set up command line argument parsing
    argParser = argparse.ArgumentParser(description = 'Get book details')

    argParser.add_argument("--incat", help = "Input catalogue file", default = None)
    argParser.add_argument("--intype",  help = "Input catalogue type", type = int, default = CatType.CT_NONE)

    argParser.add_argument("-a", "--allrecs", help = "Process all catalogue records", action = "store_true", default = False)
    argParser.add_argument("-f", "--firstrec", help = "First catalogue record", type = int, default = 3)
    argParser.add_argument("-l", "--lastrec", help = "Last catalogue record", type = int, default = 895)
    argParser.add_argument("--inter",   help = "Generate intermediate file", action = "store_true", default = False)

    argParser.add_argument("-i", "--isbn", help = "ISBN", action = "append")

    argParser.add_argument("--outcat",  help = "Output book catalogue file", default = None)
    argParser.add_argument("--outtype",  help = "Output catalogue type", type = int, default = CatType.CT_JSON)

    argParser.add_argument("--append", help = "Append to existing output catalogue file", action = "store_true", default = False)
    argParser.add_argument("-p", "--populate", help = "Populate catalogue records with openlib data", action = "store_true", default = False)
    argParser.add_argument("-v", "--verbose", help = "Show debugging output", action = "store_true", default = False)
    args = argParser.parse_args()

    input_cat_filename          = args.incat
    input_cat_type              = args.intype

    all_recs                    = args.allrecs
    first_rec                   = args.firstrec
    last_rec                    = args.lastrec
    gen_inter_cat               = args.inter

    isbns                       = args.isbn

    append                      = args.append
    populate                    = args.populate
    verbose                     = args.verbose

    output_cat_filename         = args.outcat
    output_cat_type             = args.outtype

    if input_cat_filename:
        if input_cat_type == CatType.CT_EXCEL:
            mapped_recs = []
            cat_wb      = load_workbook(input_cat_filename)
            cat_sheet   = cat_wb['Purchases']
            cat_cells   = cat_sheet['A{}'.format(first_rec):'AM{}'.format(last_rec)]

            for excel_line in cat_cells:
                flat_rec = [col.value for col in list(excel_line)]
                mapped_rec = {}
                flatToMappedRec(flat_rec, mapped_rec)
                mapped_recs.append(mapped_rec)

            if output_cat_filename:
                with open(output_cat_filename, 'w') as output_cat_file:
                    json.dump(mapped_recs, output_cat_file, indent = 4)
        elif input_cat_type == CatType.CT_TSV:
            with open(input_cat_filename) as input_cat_file:
                if all_recs:
                    inter_filename = None if not gen_inter_cat else \
                                     getInterFilename(output_cat_filename)
                    flatToMappedCat(input_cat_file,
                                    -1,
                                    -1,
                                    output_cat_filename,
                                    inter_filename,
                                    verbose,
                                    populate)
                else:
                    inter_filename = None if not gen_inter_cat else \
                                    '{}_recs_{}-{}.{}'.format(CAT_FILE_PREFIX,
                                                              first_rec,
                                                              last_rec,
                                                              CAT_FILE_INTER_SUFFIX)
                    if not output_cat_filename:
                        output_cat_filename = '{}_recs_{}-{}.{}'.format(CAT_FILE_PREFIX,
                                                                        first_rec,
                                                                        last_rec,
                                                                        CAT_FILE_SUFFIX)

                    flatToMappedCat(input_cat_file,
                                    first_rec,
                                    last_rec,
                                    output_cat_filename,
                                    inter_filename,
                                    verbose,
                                    populate)
        elif input_cat_type == CatType.CT_JSON:
            with open(input_cat_filename) as input_cat_file:
                mapped_recs = json.load(input_cat_file)
                print("Loaded JSON catalogue records")
                if output_cat_type == CatType.CT_TSV:
                    flat_rec_lines = []
                    for mapped_rec in mapped_recs:
                        flat_rec_lines.append(mappedToFlatRec(mapped_rec))
                    if output_cat_filename:
                        with open(output_cat_filename, 'w') as output_file:
                            for flat_rec_line in flat_rec_lines:
                                output_file.write('{}\n'.format(flat_rec_line))
                else:
                    # Assume populate, even if not specified
                    popMappedRecs(mapped_recs, output_cat_filename, verbose)
        else:
            print("Invalid catalogue type ({})".format(input_cat_filename))
    elif isbns:
        book_records = []
        for isbn in isbns:
            if not isValidISBN(isbn):
                print("Skipping invalid ISBN '{}'".format(isbn))
            else:
                conv_digits = ISBN13_DIGITS if len(isbn) == ISBN10_DIGITS else ISBN10_DIGITS
                isbn_conv = convISBN(isbn, conv_digits)

                book_record = {OLK_ISBN10: isbn, OLK_ISBN13: isbn_conv} if len(isbn) == ISBN10_DIGITS else \
                              {OLK_ISBN10: isbn_conv, OLK_ISBN13: isbn}
                book_records.append(book_record)

        for book_record in book_records:
            print(book_record)

        if populate:
            popMappedRecs(book_records, output_cat_filename, verbose)
###############################################################################


if __name__ == "__main__":
    main()
