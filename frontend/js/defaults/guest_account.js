/** Defines the default profile values used for unauthenticated visitors. */
export class GuestAccount {
    static get username() { return "Guest"; }
    static get displayName() { return null; }
    static get mainhand() { return "both"; }
}
