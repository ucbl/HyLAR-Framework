
# HyLAR #

HyLAR (for Hybrid Location-Agnostic Reasoning) is an adaptable architecture for OWL reasoning. It uses [JSW and OWLReasoner](https://code.google.com/p/owlreasoner/) as a triplestore and provides an additional a rule-based incremental reasoning engine. Hylar can execute its different components (classification, query answering) either on the client-side or on the server side, depending on the client capabilities or the network status.

This code can be tested at: http://dataconf.liris.cnrs.fr/hylar/

## Client-side components ##

###services/ClientResources###

This service uses the **ServerTime** remote service (through pinging) and the Device API (battery level and status) to decide the location of the classification and the query answering tasks execution (client-side or server-side).

> **resources()**

Returns an Object containing the current server ping, the battery level and charging status of the client device.

> **performClassif()**

Returns 'client' if the ping is too high (>100ms).

> **performQuerying()**

Returns 'server' if the battery level is low (<25%) while not charging.

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

> **classify()**

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

Parses the raw ontology `data` using `JswParser.parse()` , the original [rdf/xml JSW parser](https://code.google.com/p/owlreasoner/#Ontology_Object). Returns a classifiable JswOntology object.

----------

###services/ReasoningService###

> **process** (*Object* data)

If `data.command` is set to `start`, it instantiates an returns a JswReasoner instance by classifying the `data.ontology` JswOntology object. Once instantiated, if the `data.command` parameter is set to `process`, it answers the `data.sparqlQuery` String query and returns a set of results. Both commands specify their reasoning method in `data.reasoningMethod`.

----------

###resources/OntologyClassifier###

> **classify** (GET)

Remotely executes the server-side JSW parser and the JSW classifier (detailed on the server-side components below). Settable request parameters are `filename` (the name of the ontology to be parsed then classified) and  `reasoningMethod` (self-explanatory, either `greedy`or `incremental`).

----------

###resources/OntologyFetcher###

> **fetch** (GET)

Fetches a server-side rdf/xml ontology file. Name is set on the `filename`request parameter.

----------

###resources/QueryProcessor###

> **query** (GET)

Remotely calls the server-side JSW query answering task. Settable request parameters are `filename` (the name of the ontology to be parsed then classified) and  `reasoningMethod` (self-explanatory, either `greedy`or `incremental`).

----------

###resources/RemoteOntologies###

> **getList** (GET)

Returns the list of ontology files available on the server.
