
# HyLAR #

HyLAR (for Hybrid Location-Agnostic Reasoning) is an adaptable architecture for OWL reasoning based on [JSW and OWLReasoner](https://code.google.com/p/owlreasoner/). HyLAR includes a rule-based incremental reasoner and can execute its different components (classification, query answering) either on the client-side or on the server side, depending on the client capabilities or the network status.

This code can be tested at: http://dataconf.liris.cnrs.fr/hylar/

## Client-side components ##

###services/Hylar###

This main Hylar service integrates **HylarClient** and **HylarRemote** sub-services (described below). It also proposes request examples for the demo, as well as its initial configuration **Hylar.config** (reasoning method, location of the components execution, worker enabling or disabling).

>  **config.classification**

Location of the classification task. Can be set manually or automatically to either `'server'` or `'client'`.

> **config.querying**

Location of the query answering task. Can be set manually or automatically to either `'server'` or `'client'`.

> **config.inWorker**

If set to `'true'`, each component will be executed in a worker.

> **config.reasoningMethod**

Reasoning algorithm used, either `'greedy'` (naive implementation) or `'incremental'`.

----------

###services/HylarClient###

HylarClient, as its name implies, is the client-side part of Hylar, invoked when **Hylar.config.classification** or **Hylar.config.querying** are set to `'client'` value. This sub-service integrates both the **ReasoningService** and **OntologyParser** (described below).

> **process()**

Invocation of the `process()` function from the **ReasoningService** component.

> **parse()**

Invocation of the `parse()` function from the **OntologyParser** component.

----------

###services/HylarRemote###

HylarRemote is used to invoke the server-side components of Hylar, when **Hylar.config.classification** or **Hylar.config.querying** are set to `'server'`. This sub-service integrates both the **OntologyClassifier**, **OntologyFetcher**, **QueryProcessor** and **RemoteOntologies** resources (described below).

> **classify() (*String* filename, *Number* time, *String* reasoningMethod)**

Invocation of the `classify()` function from the **resources/OntologyClassifier** component.

> **fetch()**

Invocation of the `fetch()` function from the **resources/OntologyFetcher** component.

> **query()** 

Invocation of the `query()` function from the **resources/QueryProcessor** component.

> **list** 

Executes the `getList()` function from the **resources/RemoteOntologies** component and returns its result.

----------

###services/OntologyParser###

> **parse** (*String* data)

Calls `JswParser.parse()` , the original [rdf/xml JSW parser](https://code.google.com/p/owlreasoner/#Ontology_Object), on the `data` parameter.
