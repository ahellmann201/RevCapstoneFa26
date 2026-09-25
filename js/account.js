export class Account {
    static username = "Guest";
    static displayName = "Guest User";
    static email = null;
    static mainhand = "right";
    constructor({
        username = null,
        displayName = null,
        email = null,
        mainhand = "right"
    } = {})
    {
        this.username = username;
        this.displayName = displayName;
        this.email = email;
        this.mainhand = mainhand;
    }

    get username() {
        console.log(this.username);
        return this.username;
    }
}

