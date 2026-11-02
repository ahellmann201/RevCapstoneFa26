# Ciclopes UML diagrams

These Mermaid UML diagrams describe the current Android ONNX and Ciclopes API architecture. The class diagram includes method signatures, typed data fields, dashed dependency arrows, and separate colors for modules, data classes, and planned integrations. The sequence diagram uses matching green module groups, blue data/API groups, and labeled method calls. The correction-to-server handoff is marked as planned because the app currently calculates a lane homography locally but does not pass it into `/laneballs/run`.

## Add to Lucidchart

In Lucidchart, open **Diagram as code**, create a new Mermaid diagram, and paste the contents of either `.mmd` file. Lucidchart currently supports Mermaid sequence and class diagrams through this feature: <https://help.lucid.co/hc/en-us/articles/29549366940948-Diagram-as-code-with-Mermaid-in-Lucidchart>.

After generating and saving the diagram in Lucidchart, use its Share control to create a document link. This workspace has no connected Lucidchart account, so the source diagrams are prepared here but no Lucid document or share link has been created.
