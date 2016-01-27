
# HyLAR #

HyLAR (for Hybrid Location-Agnostic Reasoning) is an adaptable architecture for OWL reasoning based on [JSW and OWLReasoner](https://code.google.com/p/owlreasoner/). HyLAR includes a rule-based incremental reasoner and can execute its different components (classification, query answering) either on the client-side or on the server side, depending on the client capabilities or the network status.

This code can be tested at: http://dataconf.liris.cnrs.fr/hylar/

## Client-side components ##

###services/Hylar###

This main Hylar service integrates **services/HylarClient** and **services/HylarRemote** sub-services (described below). It also proposes request examples for the demo, as well as an initial configuration (reasoning method, location of the components execution, worker enabling or disabling).

----------

###services/HylarClient###

HylarClient, as its name implies, is the client-side part of Hylar, invoked when **Hylar.config.classification** or **Hylar.config.querying** are set to `'client'` value. This sub-service integrates both the ReasoningService and OntologyParser (described below).

> **process()**
Invocation of the `process()` function from the **services/ReasoningService** component.

> **parse()**
Invocation of the `parse()` function from the **services/OntologyParser** component.

###services/HylarRemote###

HylarRemote, references the server-side components of Hylar, invoked when **Hylar.config.classification** or **Hylar.config.querying** are set to `'server'` value.

----------

###services/OntologyParser###

> **parse** (*String* data)
Calls `JswParser.parse()` , the original [rdf/xml JSW parser](https://code.google.com/p/owlreasoner/#Ontology_Object), on the `data` parameter.
