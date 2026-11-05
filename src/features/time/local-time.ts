import {localReminder,reminderFromLocal} from '../tasks/reminder-time';
// Editing only the title must preserve sub-minute precision and the original DST fold.
export function correctedInstant(value:string,timezone:string,original?:string|null) {
 if(original && localReminder(original,timezone)===value)return original;
 const result=reminderFromLocal(value,timezone);
 if(!result)throw new Error('Date et heure requises.');
 return result;
}
