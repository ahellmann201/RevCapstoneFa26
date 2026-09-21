export class Account {
    static username = "Guest";
    static displayName = "Guest User";
    static email = null;
    constructor({
        username = "Guest",
        displayName = "Guest User",
        email = null
    } = {})
    {
        this.username = username;
        this.displayName = displayName;
        this.email = email;
    }

    get username() {
        console.log(this.username);
        return this.username;
    }
}

