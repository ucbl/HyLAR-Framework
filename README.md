

# HyLAR #

HyLAR (for Hybrid Location-Agnostic Reasoning) is an adaptable architecture for OWL reasoning, based on [JSW and OWLReasoner](https://code.google.com/p/owlreasoner/). HyLAR switches the different parts of the reasoning code either client or server side.

## Docs ##

----------
###services/Hylar###

####Hylar.config####

Hylar's global configuration, consisting in three fields :

> **classification**  (*String*)

Accepted values are `'server'` or `'client'`.

> **querying** (*String*)

Accepted values are `'server'` or `'client'`.

> **inWorker** (*Boolean*)

####Hylar.client####

Client-side part of Hylar. See **services/HylarClient**.

####Hylar.remote####

Server-side part of Hylar. See **services/HylarRemote**.

----------

###services/HylarClient###

HylarClient, as its name implies, is the client-side part of Hylar, invoked when **Hylar.config.classification** or **Hylar.config.querying** are set to `'client'` value.

####HylarClient.process ####

Invocation of the `process()` function from the **ReasoningService** component. See **services/HylarClientComponents**.

####HylarClient.parser ####
Invocation of the `parse()` function from the **OntologyParser** component. See **services/HylarClientComponents**.

----------

###services/HylarClientComponents###

####OntologyParser####
> **parse** (*String* data)
Calls `JswParser.parse()` , the original [rdf/xml JSW parser](https://code.google.com/p/owlreasoner/#Ontology_Object), on the `data` parameter.

####ReasoningService####

*tba*

----------

###services/HylarRemote###

HylarRemote, server-side part of Hylar, invoked when **Hylar.config.classification** or **Hylar.config.querying** are set to `'server'` value.

*tba*

----------

###resources/HylarRemoteComponents###

*tba*
	 

 

