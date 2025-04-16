function normalizeAllDates(dateStrings) {
  const validDates = [];
  
  for (const dateString of dateStrings) {
    const date = parseDateString(dateString);
    if (date) {
      validDates.push(date);
    }
  }
  
  // Sort dates chronologically
  validDates.sort((a, b) => a.getTime() - b.getTime());
  
  return {
    normalizedDates: validDates,
    earliestDate: validDates.length > 0 ? validDates[0] : null,
    latestDate: validDates.length > 0 ? validDates[validDates.length - 1] : null
  };
}

function parseDateString(dateString) {
  // Common date formats in the JFK files
  const formats = [
    { regex: /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(19\d{2})$/i, 
      parse: (m) => new Date(parseInt(m[3]), getMonthIndex(m[2]), parseInt(m[1])) },
    { regex: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(19\d{2})$/i, 
      parse: (m) => new Date(parseInt(m[3]), getMonthIndex(m[1]), parseInt(m[2])) },
    { regex: /^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(19\d{2})$/i, 
      parse: (m) => new Date(parseInt(m[3]), getMonthIndex(m[2]), parseInt(m[1])) },
    { regex: /^(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(19\d{2})$/i, 
      parse: (m) => new Date(parseInt(m[3]), getMonthIndex(m[2]), parseInt(m[1])) },
    { regex: /^(\d{1,2})\/(\d{1,2})\/(19\d{2})$/i, 
      parse: (m) => new Date(parseInt(m[3]), parseInt(m[1])-1, parseInt(m[2])) },
    { regex: /^(19\d{2})-(\d{1,2})-(\d{1,2})$/i, 
      parse: (m) => new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3])) },
    { regex: /^(19\d{2})$/i, 
      parse: (m) => new Date(parseInt(m[1]), 0, 1) } // Just a year = January 1st of that year
  ];

  for (const format of formats) {
    const match = dateString.match(format.regex);
    if (match) {
      try {
        const date = format.parse(match);
        if (isValidDate(date)) {
          return date;
        }
      } catch (e) {
        // Continue to next format
      }
    }
  }

  return null;
}

function getMonthIndex(month) {
  const months = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, 
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
  };
  
  return months[month.toLowerCase()] || 0;
}

function isValidDate(date) {
  return !isNaN(date.getTime());
}

module.exports = {
  normalizeAllDates,
  parseDateString
}; 