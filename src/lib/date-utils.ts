
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  getYear as dfGetYear,
  setYear as dfSetYear,
  parseISO
} from 'date-fns';

/**
 * Calculates and formats a date range string for a given week identifier.
 * Monday is considered the start of the week.
 *
 * @param weekIdentifier - The week identifier string (e.g., "Week 1", "Current Week", "yyyy-MM-dd" for Monday of a week).
 * @param referenceDate - The date to use as context. For "Week N", its year is used. For relative weeks, it's "today". For "yyyy-MM-dd", this is less critical but can be used as a fallback.
 * @returns A formatted date range string "dd/MM/yyyy - dd/MM/yyyy".
 */
export function getDisplayDateRangeForWeek(weekIdentifier: string, referenceDate: Date): string {
  let startDate: Date;
  let endDate: Date;

  // Check if weekIdentifier is a yyyy-MM-dd string (assumed to be a Monday)
  if (/^\d{4}-\d{2}-\d{2}$/.test(weekIdentifier)) {
    try {
      startDate = parseISO(weekIdentifier); // This is the Monday
      endDate = endOfWeek(startDate, { weekStartsOn: 1 });
      return `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`;
    } catch (e) {
      // If parsing fails, fall through to original logic or return identifier
      console.error(`Error parsing date string ${weekIdentifier}:`, e);
      // Fall through to treat it as a named identifier if parsing fails
    }
  }

  const weekMatch = weekIdentifier.match(/^Week (\d+)$/);

  if (weekMatch && weekMatch[1]) {
    const weekNumber = parseInt(weekMatch[1], 10);
    if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 53) {
      return weekIdentifier; // Return original if parsing fails
    }
    const year = dfGetYear(referenceDate);
    let firstMondayOfYear = startOfWeek(new Date(year, 0, 1), { weekStartsOn: 1 });
    if (dfGetYear(firstMondayOfYear) < year) {
      firstMondayOfYear = addWeeks(firstMondayOfYear, 1);
    }
    
    startDate = addWeeks(firstMondayOfYear, weekNumber - 1);
     if (dfGetYear(startDate) > year && weekNumber === 1) { 
        startDate = firstMondayOfYear;
    } else if (dfGetYear(startDate) < year && weekNumber > 1) { 
        startDate = addWeeks(firstMondayOfYear, weekNumber - 1);
    }
    endDate = endOfWeek(startDate, { weekStartsOn: 1 });

  } else {
    let baseDate = referenceDate;
    if (weekIdentifier === "Current Week") {
      // baseDate is already referenceDate
    } else if (weekIdentifier === "Next Week") {
      baseDate = addWeeks(referenceDate, 1);
    } else if (weekIdentifier === "Last Week") {
      baseDate = subWeeks(referenceDate, 1);
    } else {
      // If it wasn't yyyy-MM-dd and not a known relative/numbered week, return original
      return weekIdentifier; 
    }
    startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
    endDate = endOfWeek(baseDate, { weekStartsOn: 1 });
  }

  return `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`;
}
