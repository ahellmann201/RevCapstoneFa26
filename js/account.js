export class Account {
    constructor({
        username = "Hake",
        displayName = "John Revmetrix",
        email = "hake@email.cmail"
    } = {})
    {
        this.username = username;
        this.displayName = displayName;
        this.email = email;
    }
}