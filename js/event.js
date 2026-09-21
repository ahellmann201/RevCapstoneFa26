/*
A class for handling events

Includes:
Location (Address)
Start time (to the half-hour)
Date
*/

export default class Event {
    constructor({
        location = "Your Nearest Bowling Alley",
        date = null,
        beyondAWeek = false //used for testing, makes the date either more than 7 days out or within less than a week
    } = {}) {
        this.location = location;
        this.date = date;

        var offset = 6;
        if (beyondAWeek) {
            offset = 9;
            this.date = new Date();
            this.date.setDate(this.date.getDate() + offset);
        }
    }

    toString() {
        return `${this.location}\n${this.date.getDate()}\n${this.date.getTime()}`;
    }
}