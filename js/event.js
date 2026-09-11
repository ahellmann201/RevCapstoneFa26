/*
A class for handling events

Includes:
Location (Address)
Start time (to the half-hour)
Date
*/

export default class Event {
    constructor(location = "Your Nearest Bowling Alley", date = new Date()) {
        this.location = location;
        this.date = date;

        this.date.setDate(this.date.getDate() + 6);
    }

    toString() {
        return "${this.location}\n${this.date.getDate()}\n${this.date.getTime()}"
    }
}