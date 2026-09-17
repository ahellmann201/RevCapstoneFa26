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
        date = new Date(),
        beyondAWeek = false
    } = {}) {
        this.location = location;
        this.date = date;

        var offset = 6;
        if (beyondAWeek) offset = 9;

        this.date.setDate(this.date.getDate() + offset);
    }

    toString() {
        return `${this.location}\n${this.date.getDate()}\n${this.date.getTime()}`;
    }
}