/**
 * Created by Spadon on 17/10/2014.
 */
var CONFIG;

/** Allows to work with SQL representation of queries against RDF data. */
var TrimQueryABox = function () {
    /** The object storing ABox data. */
    this.database = {
        ClassAssertion: [],
        ObjectPropertyAssertion: []
    };

    /** The object which can be used to send queries against ABoxes. */
    this.queryLang = this.createQueryLang();
};

/** Prototype for all jsw.TrimQueryABox objects. */
TrimQueryABox.prototype = {
    /**
     * Answers the given RDF query.
     *
     * @param query RDF query to answer.
     * @return Data set containing the results matching the query.
     */
    answerQuery: function (query) {
        var sql = this.createSql(query);

        try {
            return this.queryLang.parseSQL(sql).filter(this.database);
        } catch (ex) {
            /* Recreate the query language object, since the previous object can not be used now.*/
            this.queryLang = this.createQueryLang();
            throw ex;
        }
    },

    /**
     * Adds a class assertion to the database.
     *
     * @param individualIri IRI of the individual in the assertion.
     * @param classIri IRI of the class in the assertion.
     */
    addClassAssertion: function (individualIri, classIri) {
        this.database.ClassAssertion.push({
            individual: individualIri,
            className: classIri
        });
    },

    /**
     * Adds an object property assertion to the database.
     *
     * @param objectPropertyIri IRI of the object property in the assertion.
     * @param leftIndIri IRI of the left individual in the assertion.
     * @param rightIndIri IRI of the right individual in the assertion.
     */
    addObjectPropertyAssertion: function (objectPropertyIri, leftIndIri, rightIndIri) {
        this.database.ObjectPropertyAssertion.push({
            objectProperty: objectPropertyIri,
            leftIndividual: leftIndIri,
            rightIndividual: rightIndIri
        });
    },

    /**
     * Creates an object which can be used for sending queries against the database.
     *
     * @return Object which can be used for sending queries against the database.
     */
    createQueryLang: function () {
        return TrimPath.makeQueryLang({
            ClassAssertion : { individual : { type: 'String' },
                className : { type: 'String' }},
            ObjectPropertyAssertion : { objectProperty : { type: 'String' },
                leftIndividual : { type: 'String' },
                rightIndividual : { type: 'String' }}
        });
    },

    /**
     * Returns an SQL representation of the given RDF query.
     *
     * @param query jsw.rdf.Query to return the SQL representation for.
     * @return string representation of the given RDF query.
     */
    createSql: function (query) {
        var from, limit, objectField, orderBy, predicate, predicateType, predicateValue, rdfTypeIri, /* AJOUT Lionel subClassOfIri, */
            select, subjectField, table, triple, triples, tripleCount, tripleIndex, variable, vars, varCount, varField, varFields, varIndex, where;

        from = '';
        where = '';
        rdfTypeIri = rdf.IRIs.TYPE;
//AJOUT Lionel
//subClassOfIri = jsw.rdf.IRIs.SUBCLASS;

        varFields = {};

        /** Appends a condition to the where clause based on the given expression.
         *

         * @param expr Expression to use for constructing a condition.
         * @param table Name of the table corresponding to the expression.
         * @param field Name of the field corresponding to the expression.
         */
        function writeExprCondition(expr, table, field) {
            var type = expr.type,
                value = expr.value,
                varField;

            if (type === rdf.ExpressionTypes.IRI_REF) {
                where += table + '.' + field + "=='" + value + "' AND ";
            } else if (type === rdf.ExpressionTypes.VAR) {
                varField = varFields[value];

                if (varField) {
                    where += table + '.' + field + '==' + varField + ' AND ';
                } else {
                    varFields[value] = table + '.' + field;
                }
            } else if (type === rdf.ExpressionTypes.LITERAL) {
                throw 'Literal expressions in RDF queries are not supported by the library yet!';
            } else {
                throw 'Unknown type of expression found in the RDF query: ' + type + '!';
            }
        }

        triples = query.triples;
        tripleCount = triples.length;

        for (tripleIndex = 0; tripleIndex < tripleCount; tripleIndex += 1) {
            triple = triples[tripleIndex];

            predicate = triple.predicate;
            predicateType = predicate.type;
            predicateValue = predicate.value;
            subjectField = 'leftIndividual';
            objectField = 'rightIndividual';
            table = 't' + tripleIndex;


            if (predicateType === rdf.ExpressionTypes.IRI_REF) {
                if (predicateValue === rdfTypeIri) {
                    from += 'ClassAssertion AS ' + table + ', ';
                    subjectField = 'individual';
                    objectField = 'className';

//AJOUT Lionel (pour le traitement des requêtes de subsomption de classes
                    /*
                     } else if (predicateValue === subClassOfIri) {
                     from += 'ClassAssertion AS ' + table + ', ';
                     subjectField = 'leftclassName';
                     objectField = 'rightclassName';
                     */

                } else {
                    from += 'ObjectPropertyAssertion AS ' + table + ', ';
                    where += table + ".objectProperty=='" + predicateValue + "' AND ";
                }
            } else if (predicateType === rdf.ExpressionTypes.VAR) {
                from += 'ObjectPropertyAssertion AS ' + table + ', ';
                varField = varFields[predicateValue];

                if (varField) {
                    where += table + '.objectProperty==' + varField + ' AND ';
                } else {
                    varFields[predicateValue] = table + '.objectProperty';
                }
            } else {
                throw 'Unknown type of a predicate expression: ' + predicateType + '!';
            }

            writeExprCondition(triple.subject, table, subjectField);
            writeExprCondition(triple.object, table, objectField);
        }

        if (tripleCount > 0) {
            from = ' FROM ' + from.substring(0, from.length - 2);
        }

        if (where.length > 0) {
            where = ' WHERE ' + where.substring(0, where.length - 5);
        }

        select = '';
        vars = query.variables;
        varCount = vars.length;

        if (varCount > 0) {
            for (varIndex = 0; varIndex < varCount; varIndex += 1) {
                variable = vars[varIndex].value;
                varField = varFields[variable];

                if (varField) {
                    select += varField + ' AS ' + variable + ', ';
                } else {
                    select += "'' AS " + variable + ', ';
                }
            }
        } else {
            for (variable in varFields) {
                if (varFields.hasOwnProperty(variable)) {
                    select += varFields[variable] + ' AS ' + variable + ', ';
                }
            }
        }

        if (select.length > 0) {
            select = select.substring(0, select.length - 2);
        } else {
            throw 'The given RDF query is in the wrong format!';
        }

        if (query.distinctResults) {
            select = 'SELECT DISTINCT ' + select;
        } else {
            select = 'SELECT ' + select;
        }

        orderBy = '';
        vars = query.orderBy;
        varCount = vars.length;

        for (varIndex = 0; varIndex < varCount; varIndex += 1) {
            variable = vars[varIndex];

            if (variable.type !== rdf.ExpressionTypes.VAR) {
                throw 'Unknown type of expression found in ORDER BY: ' + variable.type + '!';
            }

            orderBy += variable.value + ' ' + variable.order + ', ';
        }

        if (varCount > 0) {
            orderBy = ' ORDER BY ' + orderBy.substring(0, orderBy.length - 2);
        }

        limit = '';

        if (query.limit !== 0) {

            limit = ' LIMIT ';
            if (query.offset !== 0) {
                limit += query.offset + ', ';
            }
            limit += query.limit;
        } else if (query.offset !== 0) {
            limit = ' LIMIT ' + query.offset + ', ALL';
        }

        return select + from + where + orderBy + limit;
    }
};

/**
 * Triple storage can be used to hash 3-tuples by the values in them in some order.
 *
 * @return Object which can be used to hash 3-tuples by the values in them in some order.
 */
TripleStorage = function () {
    /**
     * Data structure holding all 3-tuples.
     */
    this.storage = {};
};

TripleStorage.prototype = {
    /**
     * Returns all Triples for a fixed value of the 1-st element in Triples and (optionally) the
     * 2-nd one.
     *
     * @param first Value of the first element of the returned Triples.
     * @param second (optional) Value of the second element of the returned Triples.
     * @return Object containing the Triples requested.
     */
    get: function (first, second) {
        var firstTuples;

        if (!first) {
            return this.storage;
        }

        firstTuples = this.storage[first];

        if (!firstTuples) {
            return {};
        }

        if (!second) {
            return firstTuples;
        }

        return firstTuples[second] || {};
    },

    /**
     * Adds the given Triple to the storage.
     *
     * @param first Value of the first element in the Triple.
     * @param second Value of the second element in the Triple.
     * @param third Value of the third element in the Triple.
     */
    add: function (first, second, third) {
        var storage = this.storage;

        if (!storage[first]) {
            storage[first] = {};
        }

        if (!storage[first][second]) {
            storage[first][second] = {};
        }

        storage[first][second][third] = true;
    },

    /**
     * Checks if the given Triple exists in the storage.
     *
     * @param first Value of the first element in the Triple.
     * @param second Value of the second element in the Triple.
     * @param third Value of the third element in the Triple.
     * @return (boolean) True if the value exists, false otherwise.
     */
    exists: function (first, second, third) {
        var storage = this.storage,
            firstStorage = storage[first],
            secondStorage;

        if (!firstStorage) {
            return false;
        }

        secondStorage = firstStorage[second];

        if (!secondStorage) {
            return false;
        }

        return secondStorage[third];


    }
};

var PairStorage = function () {
    /** Data structure holding all pairs. */
    this.storage = {};
};

/** Prototype for all jsw.util.PairStorage objects. */
PairStorage.prototype = {
    /**
     * Adds a new tuple to the storage.
     *
     * @param first Value of the first element of the tuple.
     * @param second Value for the second element of the tuple.
     */
    add: function (first, second) {
        var storage = this.storage;

        if (!storage[first]) {
            storage[first] = {};
        }

        storage[first][second] = true;
    },

    /**
     * Removes part of the relation specified by the arguments.
     *
     * @param first First value in the pairs to remove.
     * @param second (optional) Second value in the pairs to remove.
     */
    remove: function (first, second) {
        var firstPairs = this.storage[first];

        if (!firstPairs) {
            return;
        }

        if (second) {
            delete firstPairs[second];
        } else {
            delete this.storage[first];
        }
    },

    /**
     * Checks if the tuple with the given values exists within the storage.
     *
     * @param first First value in the pair.
     * @param second Second value in the pair.
     * @return boolean if the tuple with the given value exists, false otherwise.
     */
    exists: function (first, second) {
        var firstPairs = this.storage[first];

        if (!firstPairs) {
            return false;
        }

        return firstPairs[second] || false;
    },

    /**
     * Checks if tuples with the given first value and all of the given second values exist within
     * the storage.
     *
     * @param first First value in the tuple.
     * @param second Array containing the values for second element in the tuple.
     * @return boolean true if the storage contains all the tuples, false otherwise.
     */
    existAll: function (first, second) {
        var secondPairs, secondValue;

        if (!second) {
            return true;
        }

        secondPairs = this.storage[first];

        if (!secondPairs) {
            return false;
        }

        for (secondValue in second) {
            if (!secondPairs[secondValue]) {
// Some entity from subsumers array is not a subsumer.
                return false;
            }
        }

        return true;
    },

    /**
     * Returns an object which can be used to access all pairs in the storage with (optionally)
     * the fixed value of the first element in all pairs.
     *
     * @param first (optional) The value of the first element of all pairs to be returned.
     * @return Object which can be used to access all pairs in the storage.
     */
    get: function (first) {
        if (!first) {
            return this.storage;
        }

        return this.storage[first] || {};
    }
};

/** Represents a queue implementing FIFO mechanism. */
var Queue = function () {
    this.queue = [];
    this.emptyElements = 0;
};

/** Prototype for all jsw.util.Queue objects. */
Queue.prototype = {
    /**
     * Checks if the queue has no objects.
     *
     * @return (boolean) True if there are no objects in the queue, fale otherwise.
     */
    isEmpty: function () {
        return this.queue.length === 0;
    },

    /**
     * Adds an object to the queue.
     *
     * @param obj Object to add to the queue.
     */
    enqueue: function (obj) {
        this.queue.push(obj);
    },

    /**
     * Removes the oldest object from the queue and returns it.
     *
     * @return The oldest object in the queue.
     */
    dequeue: function () {
        var element,
            emptyElements = this.emptyElements,
            queue = this.queue,
            queueLength = queue.length;

        if (queueLength === 0) {
            return null;
        }

        element = queue[emptyElements];
        emptyElements += 1;

        // If the queue has more than a half empty elements, shrink it.
        if (emptyElements << 1 >= queueLength - 1) {
            this.queue = queue.slice(emptyElements);
            this.emptyElements = 0;
        } else {
            this.emptyElements = emptyElements;
        }

        return element;
    }
};

var JswUtils = {
    /**
     * Parses string into the XML DOM object in a browser-independent way.
     * @param xml String containing the XML text to parse.
     * @return XML DOM object representing the parsed XML.
     */
    parseString: function (xml) {
        var xmlDoc;

        xml = this.trim(xml);
        xmlDoc = new DOMParser().parseFromString(xml, 'text/xml');

        if (xmlDoc.nodeName === 'parsererror') {
            throw xmlDoc.childNodes[0].nodeValue;
        } else if (xmlDoc.childNodes && xmlDoc.childNodes[0] &&
            xmlDoc.childNodes[0].childNodes &&
            xmlDoc.childNodes[0].childNodes[0] &&
            xmlDoc.childNodes[0].childNodes[0].nodeName === 'parsererror') {

            throw xmlDoc.childNodes[0].childNodes[0].childNodes[1].innerText;
        }

        return xmlDoc;
    },

    /**
     * Checks if the given string is a valid URL.
     * @param str String to check.
     * @return boolean : true if the given string is a URL, false otherwise.
     */
    isUrl: function (str) {
        var regexp = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;
        return regexp.test(str);
    },

    /**
     * Removes space characters at the start and end of the given string.
     *
     * @param str String to trim.
     * @return New string with space characters removed from the start and the end.
     */
    trim: function (str) {
        return str.replace(/^\s*/, '').replace(/\s*$/, '');
    }
};

var JswOWL = {
    ExpressionTypes: {
        /** SubClassOf axiom. */
        AXIOM_CLASS_SUB: 0,
        /** EquivalentClasses axiom. */
        AXIOM_CLASS_EQ: 1,
        /** DisjointClasses axiom */
        AXIOM_CLASS_DISJOINT: 2,
        /** SubObjectPropertyOf axiom. */
        AXIOM_OPROP_SUB: 3,
        /** EquivalentObjectProperties axiom. */
        AXIOM_OPROP_EQ: 4,
        /** ReflexiveObjectProperty axiom */
        AXIOM_OPROP_REFL: 5,
        /** TransitiveObjectProperty axiom */
        AXIOM_OPROP_TRAN: 6,
        /** ObjectIntersectionOf class expression. */
        CE_INTERSECT: 7,
        /** ObjectSomeValuesFrom class expression. */
        CE_OBJ_VALUES_FROM: 8,
        /** Class entity. */
        ET_CLASS: 9,
        /** ObjectProperty entity. */
        ET_OPROP: 10,
        /** (Named)Individual entity. */
        ET_INDIVIDUAL: 11,
        /** ClassAssertion fact. */
        FACT_CLASS: 12,
        /** ObjectPropertyAssertion fact. */
        FACT_OPROP: 13,
        /** SameIndividual fact */
        FACT_SAME_INDIVIDUAL: 14,
        /** DifferentIndividuals fact */
        FACT_DIFFERENT_INDIVIDUALS: 15,
        /** ObjectPropertyChain object property expression. */
        OPE_CHAIN: 16
    },

    IRIs: {
        /** Top concept. */
        THING: 'http://www.w3.org/2002/07/owl#Thing',
        /** Bottom concept. */
        NOTHING: 'http://www.w3.org/2002/07/owl#Nothing',
        /** Top object property. */
        TOP_OBJECT_PROPERTY: 'http://www.w3.org/2002/07/owl#topObjectProperty',
        /** Bottom object property. */
        BOTTOM_OBJECT_PROPERTY: 'http://www.w3.org/2002/07/owl#bottomObjectProperty',
    }
};

/** Ontology represents a set of statements about some domain of interest. */
var JswOntology = function() {
    var exprTypes = JswOWL.ExpressionTypes,
        classType = exprTypes.ET_CLASS,
        individualType = exprTypes.ET_INDIVIDUAL,
        opropType = exprTypes.ET_OPROP;

    /** Sets of entity IRIs of different types found in the ontology. */
    this.entities = {};
    this.entities[opropType] = {};
    this.entities[classType] = {};
    this.entities[individualType] = {};

    /** Contains all axioms in the ontology. */
    this.axioms = [];

    /**
     * Contains all prefixes used in abbreviated entity IRIs in the ontology.
     * By default, contains standard prefixes defined by OWL 2 Structural Specification document.
     */
    this.prefixes = {
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        xsd: 'http://www.w3.org/2001/XMLSchema#',
        owl: 'http://www.w3.org/2002/07/owl#'
    };

    // Contains the numbers to be used in IRIs of next auto-generated entities.
    this.nextEntityNos = {};
    this.nextEntityNos[opropType] = 1;
    this.nextEntityNos[classType] = 1;
    this.nextEntityNos[individualType] = 1;

    // Contains number of entities of each type in the ontology.
    this.entityCount = {};
    this.entityCount[opropType] = 0;
    this.entityCount[classType] = 0;
    this.entityCount[individualType] = 0;
};

JswOntology.prototype = {
    /** Types of expressions which the ontology can contain. */
    exprTypes: JswOWL.ExpressionTypes,

    /**
     * Adds the given prefix to the ontology, so that the abbreviated IRIs of entities with this
     * prefix can be expanded.
     *
     * @param prefixName Name of the prefix.
     * @param iri IRI to use in abbreviated IRI expansion involving the prefix name.
     */
    addPrefix: function (prefixName, iri) {
        if (!this.prefixes[prefixName]) {
            this.prefixes[prefixName] = iri;
        }
    },

    /**
     * Allows generating a new unique IRI for the entity of the given type.
     *
     * @param type Type of the entity to generate a new unique IRI for.
     * @return string unique IRI.
     */
    createUniqueIRI: function (type) {
        var entities,
            entityPrefix = this.getEntityAutoPrefix(type),
            nextEntityNo = this.entityCount[type] + 1,
            iri;

        entities = this.entities[type];
        iri = '';

        do {
            iri = entityPrefix + nextEntityNo;
            nextEntityNo += 1;
        } while (entities.hasOwnProperty(iri));

        return iri;
    },

    /**
     * Registers the given entity in the ontology.
     *
     * @param type Type of the entity to register.
     * @param iri IRI of the entity.
     * @param isDeclared (optional) Indicates whether the entity has just been declared in the ontology and
     * not used in axioms yet. False by default.
     */
    registerEntity: function (type, iri, isDeclared) {
        var iris = JswOWL.IRIs;

        // We don't want to register default entity IRIs.
        if (type === this.exprTypes.ET_CLASS &&
            (iri === iris.THING || iri === iris.NOTHING)) {
            return;
        }

        if (type === this.exprTypes.ET_OPROP &&
            (iri === iris.TOP_OBJECT_PROPERTY || iri === iris.BOTTOM_OBJECT_PROPERTY)) {
            return;
        }

        if (!this.entities[type].hasOwnProperty(iri)) {
            this.entityCount[type] += 1;
            this.entities[type][iri] = (isDeclared);
        } else if (!isDeclared) {
            this.entities[type][iri] = false;
        }
    },

    /**
     * Checks if the ontology contains any references to the class with the given IRI.
     *
     * @param iri IRI of the class to check.
     * @return boolean - true if the ontology has reverences to the class, false otherwise.
     * @param owlIris
     */
    containsClass: function (iri, owlIris) {
        return !!(iri === owlIris.THING || iri === owlIris.NOTHING ||
            this.entities[this.exprTypes.ET_CLASS].hasOwnProperty(iri));
    },

    /**

     * Checks if the ontology contains any references to the object property with the given IRI.
     *
     * @param iri IRI of the object property to check.
     * @return boolean if the ontology has reverences to the object property, false otherwise.
     * @param owlIris
     */
    containsObjectProperty: function (iri, owlIris) {
        return !!(iri === owlIris.TOP_OBJECT_PROPERTY ||
            iri === owlIris.BOTTOM_OBJECT_PROPERTY ||
            this.entities[this.exprTypes.ET_OPROP].hasOwnProperty(iri));
    },

    /**
     * Returns an 'associative array' of all classes in the ontology.
     *
     * @return (Array) 'Associative array' of all classes in the ontology.
     */
    getClasses: function () {
        return this.entities[this.exprTypes.ET_CLASS];
    },

    /**
     * Returns a prefix to be used in the automatically generated nams for entities of the given
     * type.
     *
     * @param type Integer specifying the type of entity to get the name prefix for.
     * @return string prefix to be used in the automatically generated nams for entities of the given
     * type.
     */
    getEntityAutoPrefix: function (type) {
        var exprTypes = this.exprTypes;

        switch (type) {
            case exprTypes.ET_CLASS:
                return 'C_';
            case exprTypes.ET_OPROP:
                return 'OP_';
            case exprTypes.ET_INDIVIDUAL:
                return 'I_';
            default:
                throw 'Unknown entity type "' + type + '"!';
        }
    },

    /**
     * Returns an 'associative array' of all object properties in the ontology.
     *
     * @return (Array) 'Associative array' of all object properties in the ontology.
     */
    getObjectProperties: function () {
        return this.entities[this.exprTypes.ET_OPROP];
    },

    /**
     * Returns an 'associative array' of all individuals in the ontology.
     *
     * @return (Array) 'Associative array' of all individuals in the ontology.
     */
    getIndividuals: function () {
        return this.entities[this.exprTypes.ET_INDIVIDUAL];
    },

    /**
     * Resolves the given prefixName and otherPart to a full IRI. Checks if the prefix with the
     * given name is defined in the ontology.
     *
     * @param prefixName Name of the prefix.
     * @param otherPart Other (non-prefix) part of the abbreviated IRI.
     * @return Full IRI resolved.
     */
    resolveAbbreviatedIRI: function (prefixName, otherPart) {
        if (!this.prefixes[prefixName]) {
            throw 'Unknown IRI prefix "' + prefixName + '!"';
        }

        return this.prefixes[prefixName] + otherPart;
    }
};

var JswParser = {
    /**
     * Parses the given OWL/XML string into the Ontology object.
     * @param owlXml String containing OWL/XML to be parsed.
     * @param onError Function to be called in case if the parsing error occurs.
     * @return Ontology object representing the ontology parsed.
     */
    parse: function (owlXml, onError) {
        var exprTypes = JswOWL.ExpressionTypes, // Cash reference to the constants.
            node,                               // Will hold the current node being parsed.
            ontology = new JswOntology(),             // The ontology to be returned.
            statements = ontology.axioms;       // Will contain all statements.

        /**
         * Parses XML element representing some entity into the object. Throws an exception if the
         * name of the given element is not equal to typeName.
         * @param type Type of the entity represented by the XML element.
         * @param typeName Name of the OWL/XML element which corresponds to the given entity type.
         * @param element XML element representing some entity.
         * @param isDeclared (optional) Indicates whether the entity has been just declared in the ontology.
         * False by default.
         * @return Object representing the entity parsed.
         */
        function parseEntity(type, typeName, element, isDeclared) {
            var abbrIri, colonPos, entity, iri;

            if (element.nodeName !== typeName) {
                throw typeName + ' element expected, but not found!';
            }

            abbrIri = element.getAttribute('abbreviatedIRI');
            iri = element.getAttribute('IRI');

            // If both attributes or neither are defined on the entity, it is an error.

            if ((!iri && !abbrIri) || (iri && abbrIri)) {
                throw 'Exactly one of IRI or abbreviatedIRI attribute must be present in ' +
                    element.nodeName + ' element!';
            }

            if (!abbrIri) {
                entity = {
                    'type': type,
                    'IRI': iri
                };
            } else {
                colonPos = abbrIri.indexOf(':');

                if (colonPos < 0) {
                    throw 'Abbreviated IRI "' + abbrIri + '" does not contain a prefix name!';
                }

                if (colonPos === abbrIri.length - 1) {
                    throw 'Abbreviated IRI "' + abbrIri + '" does not contain anything after ' +
                        'the prefix!';
                }

                iri = ontology.resolveAbbreviatedIRI(
                    abbrIri.substring(0, colonPos),
                    abbrIri.substring(colonPos + 1)
                );

                // Store information about abbreviated entity IRI, so that it can be used when
                // writing the ontology back in OWL/XML.
                entity = {
                    'type': type,
                    'IRI': iri,
                    'abbrIRI': abbrIri
                };
            }

            ontology.registerEntity(type, iri, isDeclared);
            return entity;
        }

        /**
         * Parses XML element representing class intersection expression.
         * @param element XML element representing class intersection expression.
         * @return Object representing the class intersection expression.
         */
        function parseObjIntersectExpr(element) {
            var classExprs = [],
                node = element.firstChild;

            while (node) {
                if (node.nodeType === 1) {
                    classExprs.push(parseClassExpr(node));
                }

                node = node.nextSibling;
            }

            return {
                'type': exprTypes.CE_INTERSECT,
                'args': classExprs
            };
        }

        /**
         * Parses XML element representing ObjectSomeValuesFrom expression.
         * @param element XML element representing the ObjectSomeValuesFrom expression.
         * @return Object representing the expression parsed.
         */
        function parseSomeValuesFromExpr(element) {
            var oprop, classExpr, node;

            node = element.firstChild;

            while (node) {
                if (node.nodeType !== 1) {
                    node = node.nextSibling;
                    continue;
                }

                if (!oprop) {
                    oprop = parseEntity(exprTypes.ET_OPROP, 'ObjectProperty', node, false);
                } else if (!classExpr) {
                    classExpr = parseClassExpr(node);
                } else {
                    throw 'The format of ObjectSomeValuesFrom expression is incorrect!';
                }

                node = node.nextSibling;
            }

            if (!oprop || !classExpr) {
                throw 'The format of ObjectSomeValuesFrom expression is incorrect!';
            }

            return {
                'type': exprTypes.CE_OBJ_VALUES_FROM,
                'opropExpr': oprop,
                'classExpr': classExpr

            };
        }

        /**
         * Parses the given XML node into the class expression.
         * @param element XML node containing class expression to parse.
         * @return Object representing the class expression parsed.
         */
        function parseClassExpr(element) {
            switch (element.nodeName) {
                case 'ObjectIntersectionOf':
                    return parseObjIntersectExpr(element);
                case 'ObjectSomeValuesFrom':
                    return parseSomeValuesFromExpr(element);
                default:
                    return parseEntity(exprTypes.ET_CLASS, 'Class', element, false);
            }
        }

        /**
         * Parses an XML element representing the object property chain into the object.
         * @param element Element representing an object property chain.
         * @return Object representing the object property chain parsed.
         */
        function parseOpropChain(element) {
            var args = [],
                node = element.firstChild,
                opropType = exprTypes.ET_OPROP;

            while (node) {
                if (node.nodeType === 1) {
                    args.push(parseEntity(opropType, 'ObjectProperty', node, false));
                }

                node = node.nextSibling;
            }

            if (args.length < 2) {
                throw 'The object property chain should contain at least 2 object properties!';
            }

            return {
                'type': exprTypes.OPE_CHAIN,
                'args': args
            };
        }

        /**
         * Parses XML element representing SubObjectPropertyOf axiom into the object.
         * @param element OWL/XML element representing SubObjectPropertyOf axiom.
         */
        function parseSubOpropAxiom(element) {
            var firstArg, secondArg, node, opropType;

            opropType = exprTypes.ET_OPROP;
            node = element.firstChild;

            while (node) {
                if (node.nodeType !== 1) {
                    node = node.nextSibling;
                    continue;
                }

                if (!firstArg) {
                    if (node.nodeName === 'ObjectPropertyChain') {
                        firstArg = parseOpropChain(node);
                    } else {
                        firstArg = parseEntity(opropType, 'ObjectProperty', node, false);
                    }
                } else if (!secondArg) {
                    secondArg = parseEntity(opropType, 'ObjectProperty', node, false);
                } else {
                    throw 'The format of SubObjectPropertyOf axiom is incorrect!';
                }

                node = node.nextSibling;
            }

            if (!firstArg || !secondArg) {
                throw 'The format of SubObjectPropertyOf axiom is incorrect!';
            }

            statements.push({
                'type': exprTypes.AXIOM_OPROP_SUB,
                'args': [firstArg, secondArg]
            });
        }

        /**
         * Parse XML element representing a class axiom into the object.
         * @param type Type of the class axiom to parse.
         * @param element XML element representing the class axiom to parse.
         * @param minExprCount Minimum number of times the class expressions should occur in the
         * axiom.
         * @param maxExprCount Maximum number of times the class expressions should occur in the
         * axiom.
         */
        function parseClassAxiom(type, element, minExprCount, maxExprCount) {
            var args = [],
                node = element.firstChild;


            while (node) {
                if (node.nodeType === 1) {
                    args.push(parseClassExpr(node));
                }

                node = node.nextSibling;
            }

            if (!isNaN(minExprCount) && args.length < minExprCount) {
                throw 'Class axiom contains less than ' + minExprCount + ' class expressions!';
            }

            if (!isNaN(maxExprCount) && args.length > maxExprCount) {
                throw 'Class axiom contains more than ' + maxExprCount + ' class expressions!';
            }

            statements.push({
                'type': type,
                'args': args
            });
        }

        /**
         * Parses EquivalentObjectProperties XML element into the corresponding object.
         * @param element OWL/XML element representing the EquivalentObjectProperties axiom.
         */
        function parseEqOpropAxiom(element) {
            var args = [],
                node = element.firstChild,
                opropType = exprTypes.ET_OPROP;

            while (node) {
                if (node.nodeType === 1) {
                    args.push(parseEntity(opropType, 'ObjectProperty', node, false));
                }

                node = node.nextSibling;
            }

            if (args.length < 2) {
                throw 'EquivalentObjectProperties axiom contains less than 2 child elements!';
            }

            statements.push({
                'type': exprTypes.AXIOM_OPROP_EQ,
                'args': args
            });
        }

        /**
         * Parses the given XML element into the object property axiom of the given type.
         * @param type Type of an object property axiom represented by the element.
         * @param element XML element to parse into the axiom object.
         */
        function parseOpropAxiom(type, element) {
            var node = element.firstChild,
                oprop;

            while (node) {
                if (node.nodeType === 1) {
                    if (!oprop) {
                        oprop = parseEntity(exprTypes.ET_OPROP, 'ObjectProperty', node, false);
                    } else {
                        throw 'Unexpected element ' + node.nodeName + ' found inside the object ' +
                            'property axiom element!';
                    }
                }

                node = node.nextSibling;
            }

            if (!oprop) {
                throw 'Object property axiom does not contain an argument!';
            }

            statements.push({
                'type': type,
                'objectProperty': oprop
            });
        }

        /**
         * Parses Declaration OWL/XML element into the corresponding entity object within the
         * ontology.
         * @param element OWL/XML Declaration element to parse.
         */
        function parseDeclaration(element) {
            var found = false,
                node = element.firstChild,
                nodeName;

            // This will not detect (and report) declarations of other entity types. On purpose.
            while (node) {
                if (node.nodeType === 1) {
                    nodeName = node.nodeName;

                    if (found) {
                        throw 'Unexpected element "' + nodeName + '" found in Declaration element!';
                    }

                    switch (nodeName) {
                        case 'Class':
                            parseEntity(exprTypes.ET_CLASS, 'Class', node, true);
                            found = true;
                            break;
                        case 'ObjectProperty':
                            parseEntity(exprTypes.ET_OPROP, 'ObjectProperty', node, true);
                            found = true;
                            break;
                        case 'NamedIndividual':
                            parseEntity(exprTypes.ET_INDIVIDUAL, 'NamedIndividual', node, true);
                            found = true;
                            break;
                    }
                }

                node = node.nextSibling;
            }
        }

        /**
         * Parses ClassAssertion XML element into the corresponding object.
         * @param element OWL/XML ClassAssertion element.
         */
        function parseClassAssertion(element) {
            var classExpr, individual, node;

            node = element.firstChild;

            while (node) {
                if (node.nodeType !== 1) {
                    node = node.nextSibling;
                    continue;
                }

                if (!classExpr) {
                    classExpr = parseClassExpr(node);
                } else if (!individual) {
                    individual = parseEntity(exprTypes.ET_INDIVIDUAL, 'NamedIndividual', node, false);
                } else {
                    throw 'Incorrect format of the ClassAssertion element!';
                }

                node = node.nextSibling;
            }

            if (!classExpr || !individual) {
                throw 'Incorrect format of the ClassAssertion element!';
            }

            statements.push({
                'type': exprTypes.FACT_CLASS,
                'individual': individual,
                'classExpr': classExpr
            });
        }

        /**
         * Parses ObjectPropertyAssertion OWL/XML element into the corresponding object.
         *
         * @param element OWL/XML ObjectPropertyAssertion element to parse.
         */
        function parseObjectPropertyAssertion(element) {
            var individualType, leftIndividual, node, objectProperty, rightIndividual;

            individualType = exprTypes.ET_INDIVIDUAL;
            node = element.firstChild;

            while (node) {
                if (node.nodeType !== 1) {
                    node = node.nextSibling;
                    continue;
                }

                if (!objectProperty) {
                    objectProperty = parseEntity(exprTypes.ET_OPROP, 'ObjectProperty', node, false);
                } else if (!leftIndividual) {
                    leftIndividual = parseEntity(individualType, 'NamedIndividual', node, false);
                } else if (!rightIndividual) {
                    rightIndividual = parseEntity(individualType, 'NamedIndividual', node, false);
                } else {
                    throw 'Incorrect format of the ObjectPropertyAssertion element!';
                }

                node = node.nextSibling;
            }

            if (!objectProperty || !leftIndividual || !rightIndividual) {
                throw 'Incorrect format of the ObjectPropertyAssertion element!';
            }

            statements.push({
                'type': exprTypes.FACT_OPROP,
                'leftIndividual': leftIndividual,
                'objectProperty': objectProperty,
                'rightIndividual': rightIndividual
            });
        }

        /**
         * Parses OWL/XML element representing an assertion about individuals into the corresponding
         * object.
         * @param element OWL/XML element to parse.
         * @param type
         */
        function parseIndividualAssertion(element, type) {
            var individuals, individualType, node;

            individualType = exprTypes.ET_INDIVIDUAL;
            node = element.firstChild;
            individuals = [];

            while (node) {
                if (node.nodeType !== 1) {
                    node = node.nextSibling;
                    continue;
                }

                individuals.push(parseEntity(individualType, 'NamedIndividual', node, false));
                node = node.nextSibling;
            }

            if (individuals.length < 2) {
                throw 'Incorrect format of the ' + element.nodeName + ' element!';
            }

            statements.push({
                'type': type,
                'individuals': individuals
            });
        }

        /**
         * Parses the given OWL/XML Prefix element and adds the information about this prefix to the
         * ontology.
         * @param element OWL/XML Prefix element.
         */
        function parsePrefixDefinition(element) {
            var prefixName = element.getAttribute('name'),
                prefixIri = element.getAttribute('IRI');

            if (prefixName === null || !prefixIri) {
                throw 'Incorrect format of Prefix element!';
            }

            ontology.addPrefix(prefixName, prefixIri);
        }

        node = JswUtils.parseString(owlXml).documentElement.firstChild;

        // OWL/XML Prefix statements (if any) should be at the start of the document. We need them
        // to expand abbreviated entity IRIs.
        while (node) {
            if (node.nodeType === 1) {
                if (node.nodeName === 'Prefix') {
                    parsePrefixDefinition(node);
                } else {
                    break;
                }
            }

            node = node.nextSibling;
        }

        // Axioms / facts (if any) follow next.
        while (node) {
            if (node.nodeType !== 1) {
                node = node.nextSibling;
                continue;
            }

            try {
                switch (node.nodeName) {
                    case 'Declaration':
                        parseDeclaration(node);
                        break;
                    case 'SubClassOf':
                        parseClassAxiom(exprTypes.AXIOM_CLASS_SUB, node, 2, 2);
                        break;
                    case 'EquivalentClasses':
                        parseClassAxiom(exprTypes.AXIOM_CLASS_EQ, node, 2);
                        break;
                    case 'DisjointClasses':
                        parseClassAxiom(exprTypes.AXIOM_CLASS_DISJOINT, node, 2);
                        break;
                    case 'SubObjectPropertyOf':
                        parseSubOpropAxiom(node);
                        break;
                    case 'EquivalentObjectProperties':
                        parseEqOpropAxiom(node);
                        break;
                    case 'ReflexiveObjectProperty':
                        parseOpropAxiom(exprTypes.AXIOM_OPROP_REFL, node);
                        break;
                    case 'TransitiveObjectProperty':
                        parseOpropAxiom(exprTypes.AXIOM_OPROP_TRAN, node);
                        break;
                    case 'ClassAssertion':
                        parseClassAssertion(node);
                        break;
                    case 'ObjectPropertyAssertion':
                        parseObjectPropertyAssertion(node);
                        break;
                    case 'SameIndividual':
                        parseIndividualAssertion(node, exprTypes.FACT_SAME_INDIVIDUAL);
                        break;
                    case 'DifferentIndividuals':
                        parseIndividualAssertion(node, exprTypes.FACT_DIFFERENT_INDIVIDUALS);
                        break;
                    case 'Prefix':
                        throw 'Prefix elements should be at the start of the document!';
                }
            } catch (ex) {
                if (!onError || !onError(ex)) {
                    throw ex;
                }
            }

            node = node.nextSibling;
        }

        return ontology;
    },

    /**
     * Parses the OWL/XML ontology located at the given url.
     * @param url URL of the OWL/XML ontology to be parsed.
     * @param onError Function to be called in case if the parsing error occurs.
     * @return Ontology object representing the ontology parsed.
     */
    parseUrl: function (url, onError) {
        var newUrl = JswUtils.trim(url),
            owlXml;

        if (!JswUtils.isUrl(newUrl)) {
            throw '"' + url + '" is not a valid URL!';
        }

        owlXml = new TextFile(url).getText();
        return this.parse(owlXml, onError);
    }
}

/** Stopwatch allows measuring time between different events. */
var Stopwatch = function () {

    var startTime, // Time (in milliseconds) when the stopwatch was started last time.
        elapsedMs = null; // Contains the number of milliseconds in the last measured period of time.

    /**
     * Returns textual representation of the last measured period of time.
     *
     * @return string representation of the last measured period of time.
     */
    this.getElapsedTimeAsText = function () {
        var milliseconds = elapsedMs % 1000,
            hours = Math.floor(elapsedMs / 3600000),
            minutes = Math.floor(elapsedMs % 3600000 / 60000),
            seconds = Math.floor(elapsedMs % 60000 / 1000);

        if (milliseconds < 10) {
            milliseconds = '00' + milliseconds.toString();
        } else if (milliseconds < 100) {
            milliseconds = '0' + milliseconds.toString();
        }

        return hours + ' : ' + minutes + ' : ' + seconds + '.' + milliseconds;
    };

    /**
     * Starts measuring the time.
     */
    this.start = function () {
        startTime = new Date().getTime();
        elapsedMs = null;
    };

    /**
     * Stops measuring the time.
     *
     * @return string representation of the measured period of time.
     */
    this.stop = function () {
        elapsedMs = new Date().getTime() - startTime;
        return this.getElapsedTimeAsText();
    };
};

/**
 * BrandT is an OWL-EL reasoner. Currently, it has some limitations and does not allow
 * reasoning on full EL++, but it does cover EL+ and its minor extensions.
 */
var BrandT = function (data) {
    var clock, normalizedOntology;
    CONFIG = data;
    CONFIG.resultOntology = new JswOntology();

    /** Stores information about how much time different steps of building a reasoner took. */
    this.timeInfo = {};
    /** Original ontology from which the reasoner was built. */
    CONFIG.originalOntology = CONFIG.ontology;
    CONFIG.ontology.__proto__ = JswOntology.prototype

    clock = new Stopwatch();

    clock.start();
    normalizedOntology = this.normalizeOntology(CONFIG.ontology);
    this.timeInfo.normalization = clock.stop();

    clock.start();
    CONFIG.objectPropertySubsumers = this.buildObjectPropertySubsumerSets(normalizedOntology);
    this.timeInfo.objectPropertySubsumption = clock.stop();

    clock.start();
    this.classSubsumers = this.buildClassSubsumerSets(normalizedOntology);
    this.timeInfo.classification = clock.stop();

    clock.start();
    /** Rewritten A-Box of the ontology. */
    this.aBox = this.rewriteAbox(normalizedOntology);
    this.timeInfo.aBoxRewriting = clock.stop();

    // Remove entity IRIs introduced during normalization stage from the subsumer sets.
    this.removeIntroducedEntities(
        this.classSubsumers,
        CONFIG.ontology.getClasses(),
        [JswOWL.IRIs.THING, JswOWL.IRIs.NOTHING]
    );
    this.removeIntroducedEntities(
        CONFIG.objectPropertySubsumers,
        CONFIG.ontology.getObjectProperties(),
        [JswOWL.IRIs.TOP_OBJECT_PROPERTY, JswOWL.IRIs.BOTTOM_OBJECT_PROPERTY]
    );

    clock.start();
    this.timeInfo.classHierarchy = clock.stop();

    clock.start();
    this.timeInfo.objectPropertyHierarchy = clock.stop();
};

/** Prototype for all BrandT objects. */
BrandT.prototype = {
    /**
     * Builds an object property subsumption relation implied by the ontology.
     *
     * @param ontology Normalized ontology to be use for building the subsumption relation.
     * @return PairStorage storage hashing the object property subsumption relation implied by the
     * ontology.
     */
    buildObjectPropertySubsumerSets: function (ontology) {
        var args, axiom, axioms, axiomIndex, objectProperties, objectProperty,
            objectPropertySubsumers, opropType, reqAxiomType, queue, subsumer, subsumers,
            topObjectProperty;

        topObjectProperty = JswOWL.IRIs.TOP_OBJECT_PROPERTY;
        objectPropertySubsumers = new PairStorage();
        objectPropertySubsumers.add(topObjectProperty, topObjectProperty);
        objectProperties = ontology.getObjectProperties();

        for (objectProperty in objectProperties) {
            if (objectProperties.hasOwnProperty(objectProperty)) {
                // Every object property is a subsumer for itself.
                objectPropertySubsumers.add(objectProperty, objectProperty);
                // Top object property is a subsumer for every other property.
                objectPropertySubsumers.add(objectProperty, topObjectProperty);
            }
        }

        axioms = ontology.axioms;
        opropType = JswOWL.ExpressionTypes.ET_OPROP;
        reqAxiomType = JswOWL.ExpressionTypes.AXIOM_OPROP_SUB;

        // Add object property subsumptions explicitly mentioned in the ontology.
        for (axiomIndex = axioms.length; axiomIndex--;) {
            axiom = axioms[axiomIndex];
            args = axiom.args;

            if (axiom.type !== reqAxiomType || args[0].type !== opropType) {
                continue;
            }

            objectPropertySubsumers.add(args[0].IRI, args[1].IRI);
        }

        queue = new Queue();

        for (objectProperty in objectProperties) {
            if (!objectProperties.hasOwnProperty(objectProperty)) {
                continue;
            }

            subsumers = objectPropertySubsumers.get(objectProperty);

            for (subsumer in subsumers) {
                if (subsumers.hasOwnProperty(subsumer)) {
                    queue.enqueue(subsumer);
                }
            }

            // Discover implicit subsumptions via intermediate object properties.
            while (!queue.isEmpty()) {
                subsumers = objectPropertySubsumers.get(queue.dequeue());

                for (subsumer in subsumers) {
                    if (subsumers.hasOwnProperty(subsumer)) {
                        // If the objectProperty has subsumer added in its subsumer set, then that
                        // subsumer either was processed already or has been added to the queue - no
                        // need to process it for the second time.
                        if (!objectPropertySubsumers.exists(objectProperty, subsumer)) {
                            objectPropertySubsumers.add(objectProperty, subsumer);
                            queue.enqueue(subsumer);
                        }
                    }
                }
            }
        }

        return objectPropertySubsumers;
    },

    /**
     * Builds a class subsumption relation implied by the ontology.
     *
     * @param ontology Ontology to use for building subsumer sets. The ontology has to be
     * normalized.
     * @return PairStorage storage containing the class subsumption relation implied by the ontology.
     */
    buildClassSubsumerSets: function (ontology) {
        var a,
            labelNodeIfAxioms1 = [],
            labelNodeIfAxioms2 = [],
            labelNodeAxioms = [],
            labelEdgeAxioms = [],
            labelNodeIfAxiom1Count,
            labelNodeIfAxiom2Count,
            labelNodeAxiomCount,
            labelEdgeAxiomCount,
            b,
        // Provides quick access to axioms like r o s <= q.
            chainSubsumers = this.buildChainSubsumerSets(),
        // Stores labels for each node.
            classSubsumers = new PairStorage(),
        // Stores labels for each edge.
            edgeLabels = new TripleStorage(),
            instruction,
            leftChainSubsumers = chainSubsumers.left,
            node,
            nothing = JswOWL.IRIs.NOTHING,
            originalOntology = CONFIG.originalOntology,
            queue,
            queues = {},
            rightChainSubsumers = chainSubsumers.right,
            p,
            someInstructionFound;

        /**
         * Splits the axiom set of the ontology into several subsets used for different purposes.
         */
        function splitAxiomSet() {
            var axiom, axioms, axiomIndex, axiomType, classType, firstArgType,
                intersectType, reqAxiomType, secondArgType, someValuesType;

            reqAxiomType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;
            classType = JswOWL.ExpressionTypes.ET_CLASS;
            intersectType = JswOWL.ExpressionTypes.CE_INTERSECT;
            someValuesType = JswOWL.ExpressionTypes.CE_OBJ_VALUES_FROM;
            axioms = ontology.axioms;

            for (axiomIndex = axioms.length; axiomIndex--;) {
                axiom = axioms[axiomIndex];
                axiomType = axiom.type;

                if (axiom.type !== reqAxiomType) {
                    continue;
                }

                secondArgType = axiom.args[1].type;

                if (secondArgType === classType) {
                    firstArgType = axiom.args[0].type;

                    if (firstArgType === classType) {
                        labelNodeIfAxioms1.push(axiom);
                    } else if (firstArgType === intersectType) {
                        labelNodeIfAxioms2.push(axiom);
                    } else if (firstArgType === someValuesType) {
                        labelNodeAxioms.push(axiom);
                    }
                } else if (secondArgType === someValuesType) {
                    if (axiom.args[0].type === classType) {
                        labelEdgeAxioms.push(axiom);
                    }
                }
            }

            labelNodeAxiomCount = labelNodeAxioms.length;
            labelNodeIfAxiom1Count = labelNodeIfAxioms1.length;
            labelNodeIfAxiom2Count = labelNodeIfAxioms2.length;
            labelEdgeAxiomCount = labelEdgeAxioms.length;
        }

        /**
         * Adds instructions
         *
         * 'Label B as C if it is labeled A1, A2, ..., Am already'
         *
         * to the queue of B for all axioms like
         *
         * A1 n A2 n ... n A n ... n Am <= C.
         *
         * @param a
         * @param b
         */
        function addLabelNodeIfInstructions(a, b) {
            var axioms, args, axiomIndex, canUse, classes, classCount, classIndex, classIri,
                reqLabels;

            axioms = labelNodeIfAxioms1;

            for (axiomIndex = labelNodeIfAxiom1Count; axiomIndex--;) {
                args = axioms[axiomIndex].args;

                if (args[0].IRI === a) {
                    queues[b].enqueue({
                        'type': 0,
                        'node': b,
                        'label': args[1].IRI,
                        'reqLabels': null
                    });
                }
            }

            axioms = labelNodeIfAxioms2;

            for (axiomIndex = labelNodeIfAxiom2Count; axiomIndex--;) {
                args = axioms[axiomIndex].args;
                classes = args[0].args;
                classCount = classes.length;
                canUse = false;

                for (classIndex = classCount; classIndex--;) {
                    if (classes[classIndex].IRI === a) {
                        canUse = true;
                        break;
                    }
                }

                if (!canUse) {
                    // Axiom does not contain A on the left side
                    continue;
                }

                reqLabels = {};

                for (classIndex = classCount; classIndex--;) {
                    classIri = classes[classIndex].IRI;

                    if (classIri !== a) {
                        reqLabels[classIri] = true;
                    }
                }

                queues[b].enqueue({
                    'type': 0,
                    'node': b,
                    'label': args[1].IRI,
                    'reqLabels': reqLabels
                });
            }
        }

        /**
         * Adds instructions
         *
         * 'Label B with C'
         *
         * to the queue of B for all axioms like
         *
         * E P.A <= C.
         *
         * @param p IRI of the object property to look for in axioms.
         * @param a IRI of the class to look for in the left part of axioms.
         * @param b IRI of the class to add instructions to.
         */
        function addLabelNodeInstructions(p, a, b) {
            var axioms, args, axiomIndex, firstArg;

            axioms = labelNodeAxioms;

            for (axiomIndex = labelNodeAxiomCount; axiomIndex--;) {
                args = axioms[axiomIndex].args;
                firstArg = args[0];

                if (firstArg.opropExpr.IRI === p && firstArg.classExpr.IRI === a) {
                    queues[b].enqueue({
                        'type': 0,
                        'node': b,
                        'label': args[1].IRI
                    });
                }
            }
        }

        /**
         * Adds instructions
         *
         * 'Label the edge (B, C) as P'
         *
         * to the queue of B for all axioms like
         *
         * A <= E P.C
         *
         * @param a
         * @param b
         */
        function addLabelEdgeInstructions(a, b) {
            var axioms, args, axiomIndex, secondArg;

            axioms = labelEdgeAxioms;

            for (axiomIndex = labelEdgeAxiomCount; axiomIndex--;) {
                args = axioms[axiomIndex].args;
                secondArg = args[1];

                if (args[0].IRI !== a) {
                    continue;
                }

                queues[b].enqueue({
                    'type': 1,
                    'node1': b, // IRI of the source node of the edge.
                    'node2': secondArg.classExpr.IRI, // IRI of the destination node of the edge.
                    'label': secondArg.opropExpr.IRI // IRI of the label to add to the edge.
                });
            }
        }

        /**
         * Adds instructions to the queue of class B for axioms involving class A.
         *
         * @param a IRI of the class to look for in axioms.
         * @param b IRI of the class to add instructions for.
         */
        function addInstructions(a, b) {
            addLabelNodeIfInstructions(a, b);
            addLabelEdgeInstructions(a, b);
        }

        /**
         * Initialises a single node of the graph before the subsumption algorithm is run.
         *
         * @param classIri IRI of the class to initialize a node for.
         */
        function initialiseNode(classIri) {
// Every class is a subsumer for itself.
            classSubsumers.add(classIri, classIri);

// Initialise an instruction queue for the node.
            queues[classIri] = new Queue();

// Add any initial instructions about the class to the queue.
            addInstructions(classIri, classIri);
        }

        /**
         * Initialises data structures before the subsumption algorithm is run.
         */
        function initialise() {
            var classes = ontology.getClasses(),
                classIri,
                thing = JswOWL.IRIs.THING;

// Put different axioms into different 'baskets'.
            splitAxiomSet();

// Create a node for Thing (superclass).
            initialiseNode(thing);

            for (classIri in classes) {
                if (classes.hasOwnProperty(classIri) && !classes[classIri]) {
// Create a node for each class in the Ontology.
                    initialiseNode(classIri);

// Mark Thing as a subsumer of the class.
                    classSubsumers.add(classIri, thing);

// All axioms about Thing should also be true for any class.
                    addInstructions(thing, classIri);
                }
            }
        }

        /**
         * Adds subsumers sets for classes which have not been found in the TBox of the ontology.
         */
        function addRemainingSubsumerSets() {
            var classes = ontology.getClasses(),
                classIri,
                nothing = JswOWL.IRIs.NOTHING,
                originalClasses = CONFIG.originalOntology.getClasses(),
                thing = JswOWL.IRIs.THING;

            // We add Nothing to the subsumer sets only if some of the original classes has Nothing
            // as a subsumer.
            for (classIri in classSubsumers.get(null)) {
                if (originalClasses.hasOwnProperty(classIri) &&
                    classSubsumers.exists(classIri, nothing)) {
                    // In principle, everything is a subsumer of Nothing, but we ignore it.
                    classSubsumers.add(nothing, nothing);
                    classSubsumers.add(nothing, thing);
                    break;
                }
            }

            for (classIri in ontology.getClasses()) {
                if (classes.hasOwnProperty(classIri) && classes[classIri]) {
                    classSubsumers.add(classIri, classIri);
                    classSubsumers.add(classIri, thing);
                }
            }
        }

        /**
         * Processes an instruction to add a new edge.
         *
         * @param a
         * @param b
         * @param p
         */
        function processNewEdge(a, b, p) {
            var bSubsumers, c, classes, edges, lChainSubsumers, q, r, rChainSubsumers, s;

            classes = classSubsumers.get(null);
            edges = edgeLabels;
            bSubsumers = classSubsumers.get(b);
            lChainSubsumers = leftChainSubsumers;
            rChainSubsumers = rightChainSubsumers;

            // For all subsumers of object property P, including P itself.
            for (q in CONFIG.objectPropertySubsumers.get(p)) {
                // Add q as a label between A and B.
                edges.add(a, b, q);

                // Since we discovered that A <= E Q.B, we know that A <= E Q.C, where C is any
                // subsumer of B. We therefore need to look for new subsumers D of A by checking
                // all axioms like E Q.C <= D.
                for (c in bSubsumers) {
                    addLabelNodeInstructions(q, c, a);
                }

                // We want to take care of object property chains. We now know that Q: A -> B.
                // If there is another property R: C -> A for some class C and property S, such that
                // R o Q <= S, we want to label edge (C, B) with S.
                for (r in rChainSubsumers.get(q)) {
                    for (s in rChainSubsumers.get(q, r)) {
                        for (c in classes) {
                            if (edges.exists(c, a, r) && !edges.exists(c, b, s)) {
                                processNewEdge(c, b, s);
                            }
                        }
                    }
                }

                // We want to take care of object property chains. We now know that Q: A -> B.
                // If there is another property R: B -> C for some class C and property S, such that
                // Q o R <= S, we want to label edge (A, C) with S.
                for (r in lChainSubsumers.get(q)) {
                    for (s in lChainSubsumers.get(q, r)) {
                        for (c in classes) {
                            if (edges.exists(b, c, r) && !edges.exists(a, c, s)) processNewEdge(a, c, s);
                        }
                    }
                }
            }
        }

        /**
         * Processes the given Label Edge instruction.
         *
         * @param instruction Label Edge instruction to process.
         */
        function processLabelEdgeInstruction(instruction) {
            var p = instruction.label,
                a = instruction.node1,
                b = instruction.node2;

// If the label exists already, no need to process the instruction.
            if (!edgeLabels.exists(a, b, p)) {
                processNewEdge(a, b, p);
            }
        }

        /**
         * Processes the given Label Node instruction.
         *
         * @param instruction Label Node instruction to process.
         */
        function processLabelNodeInstruction(instruction) {
            var a, b, c, edges, p, subsumers;

            a = instruction.node;
            b = instruction.label;
            edges = edgeLabels;
            subsumers = classSubsumers;

            if (subsumers.exists(a, b) || !subsumers.existAll(a, instruction.reqLabels)) {
// The node is not labeled with all required labels yet or it has been labeled
// with the new label already - there is no point to process the operation anyway.
                return;
            }

// Otherwise, add a label to the node.
            subsumers.add(a, b);

// Since B is a new discovered subsumer of A, all axioms about B apply to A as well -
// we need to update node instruction queue accordingly.
            addInstructions(b, a);

// We have discovered a new information about A, so we need to update all other nodes
// linked to it.
            for (c in edges.get(null, null)) {
                for (p in edges.get(c, a)) {
// For all C <= E P.A, we now know that C <= E P.B. And therefore C should have
// the same subsumers as E P.B.
                    addLabelNodeInstructions(p, b, c);
                }
            }
        }

// Initialise queues and labels.
        initialise();

        do {
            someInstructionFound = false;

// Get a queue which is not empty.
            for (node in queues) {

                queue = queues[node];

                if (!queue.isEmpty()) {
// Process the oldest instruction in the queue.
                    instruction = queue.dequeue();

                    switch (instruction.type) {
                        case 0:
                            processLabelNodeInstruction(instruction);
                            break;
                        case 1:
                            processLabelEdgeInstruction(instruction);
                            break;
                        default:
                            throw 'Unrecognized type of instruction found in the queue!';
                    }

                    someInstructionFound = true;
                    break;
                }
            }
        } while (someInstructionFound);

        do {
            someInstructionFound = false;

            for (a in edgeLabels.get(null, null)) {
                if (classSubsumers.exists(a, nothing)) {
                    continue;
                }

                for (b in edgeLabels.get(a, null)) {
                    for (p in edgeLabels.get(a, b)) {
                        if (classSubsumers.exists(b, nothing)) {
                            classSubsumers.add(a, nothing);
                        }
                    }
                }
            }
        } while (someInstructionFound);

// Add a subsumer set for every class which did not participate in TBox.
        addRemainingSubsumerSets();

        return classSubsumers;
    },

    /**
     * Removes from subsumer sets references to entities which have been introduced during
     * normalization stage.
     *
     * @param subsumerSets Subsumer sets to remove the introduced entities from.
     * @param originalEntities Object containing IRIs of original entities as properties.
     * @param allowedEntities Array containing names of entites which should not be removed if they
     * are present in the subsumer sets.
     */
    removeIntroducedEntities: function (subsumerSets, originalEntities, allowedEntities) {
        var allowedCount = allowedEntities.length,
            entityIri,
            subsumerIri;

        /**
         * Checks if the given given entity IRI has been introduced during normalization stage.
         *
         * @param entityIri IRI of the entity to check.
         * @return boolean - true if the entity has been introduced, false otherwise.
         */
        function isIntroducedEntity(entityIri) {
            var index;

            if (originalEntities.hasOwnProperty(entityIri)) {
                return true;
            }

            for (index = allowedCount; index--;) {
                if (allowedEntities[index] === entityIri) {
                    return true;
                }
            }
        }

// Remove introduced entities from subsumer sets.
        for (entityIri in subsumerSets.get()) {
            if (!isIntroducedEntity(entityIri)) {
                subsumerSets.remove(entityIri);
                continue;
            }

            for (subsumerIri in subsumerSets.get(entityIri)) {
                if (!isIntroducedEntity(subsumerIri)) {
                    subsumerSets.remove(entityIri, subsumerIri);
                }
            }
        }
    },

    /**
     * Creates an object which hashes axioms like r o s <= q, so that all axioms related to either
     * q or s can be obtained efficiently. Normalized ontology containing the axioms to hash.
     * @return Object hashing all object property chain subsumptions.
     */
    buildChainSubsumerSets: function () {
        var args, axiom, axioms, axiomIndex, chainSubsumer, leftSubsumers, leftOprop,
            opropChainType, reqAxiomType, rightOprop, rightSubsumers;

        axioms = CONFIG.ontology.axioms;

        leftSubsumers = new TripleStorage();
        rightSubsumers = new TripleStorage();

        reqAxiomType = JswOWL.ExpressionTypes.AXIOM_OPROP_SUB;
        opropChainType = JswOWL.ExpressionTypes.OPE_CHAIN;

        for (axiomIndex = axioms.length; axiomIndex--;) {
            axiom = axioms[axiomIndex];

            if (axiom.type !== reqAxiomType || axiom.args[0].type !== opropChainType) {
                continue;
            }

            args = axiom.args[0].args;
            leftOprop = args[0].IRI;
            rightOprop = args[1].IRI;
            chainSubsumer = axiom.args[1].IRI;

            leftSubsumers.add(leftOprop, rightOprop, chainSubsumer);
            rightSubsumers.add(rightOprop, leftOprop, chainSubsumer);
        }

        return {
            'left': leftSubsumers,
            'right': rightSubsumers
        };
    },

    /**
     * Rewrites an ABox of the ontology into the relational database to use it for conjunctive query
     * answering.
     *
     * @param ontology Normalized ontology containing the ABox to rewrite.
     * @return TrimQueryABox object containing the rewritten ABox.
     */
    rewriteAbox: function (ontology) {
        var axioms = ontology.axioms,
            axiomCount = axioms.length,
            classSubsumers = this.classSubsumers,
            aBox = new TrimQueryABox(),
            objectPropertySubsumers = CONFIG.objectPropertySubsumers,
            originalOntology = this.originalOntology;

        /**
         * Puts class assertions implied by the ontology into the database.
         *
         * @return Array containing all class assertions implied by the ontology.
         */
        function rewriteClassAssertions() {
            var axiom, axiomIndex, classFactType, classIri, individualClasses, individualIri,
                subsumerIri;

            individualClasses = new PairStorage();
            classFactType = JswOWL.ExpressionTypes.FACT_CLASS;

            for (axiomIndex = axiomCount; axiomIndex--;) {
                axiom = axioms[axiomIndex];

                if (axiom.type !== classFactType) {
                    continue;
                }

                individualIri = axiom.individual.IRI;
                classIri = axiom.classExpr.IRI;

                for (subsumerIri in classSubsumers.get(classIri)) {
                    if (CONFIG.originalOntology.containsClass(subsumerIri, JswOWL.IRIs)) {
                        individualClasses.add(individualIri, subsumerIri);
                    }
                }
            }

            // Put class assertions into the database.
            for (individualIri in individualClasses.get(null)) {
                for (classIri in individualClasses.get(individualIri)) {
                    aBox.addClassAssertion(individualIri, classIri);
                }
            }
        }

        /**
         * Puts role assertions implied by the ontology into the database.
         *
         * @return Array containing all object property assertions implied by the ontology.
         */
        function rewriteObjectPropertyAssertions() {
            var args, axiom, axiomIndex, centerInd, chainSubsumer, changesHappened, individual,
                individuals, opropSubsumer, leftInd, leftOprop, oprop, opropFactType,
                reflexiveOpropType, reqAxiomType, reqExprType, rightInd, rightOprop, storage;

            storage = new TripleStorage();
            reflexiveOpropType = JswOWL.ExpressionTypes.AXIOM_OPROP_REFL;
            opropFactType = JswOWL.ExpressionTypes.FACT_OPROP;
            individuals = CONFIG.originalOntology.getIndividuals();

            for (axiomIndex = axiomCount; axiomIndex--;) {
                axiom = axioms[axiomIndex];

                // Reflexive object properties.
                if (axiom.type === reflexiveOpropType) {
                    for (opropSubsumer in objectPropertySubsumers.get(axiom.objectProperty.IRI)) {
                        for (individual in individuals) {
                            storage.add(opropSubsumer, individual, individual);
                        }
                    }
                } else if (axiom.type === opropFactType) {
                    leftInd = axiom.leftIndividual.IRI;
                    rightInd = axiom.rightIndividual.IRI;

                    for (opropSubsumer in objectPropertySubsumers.get(axiom.objectProperty.IRI)) {
                        storage.add(opropSubsumer, leftInd, rightInd);
                    }
                }
            }

            reqAxiomType = JswOWL.ExpressionTypes.AXIOM_OPROP_SUB;
            reqExprType = JswOWL.ExpressionTypes.OPE_CHAIN;

            do {
                changesHappened = false;

                for (axiomIndex = axiomCount; axiomIndex--;) {
                    axiom = ontology.axioms[axiomIndex];

                    if (axiom.type !== reqAxiomType || axiom.args[0].type !== reqExprType) {
                        continue;
                    }

                    args = axiom.args[0].args;
                    leftOprop = args[0].IRI;
                    rightOprop = args[1].IRI;
                    chainSubsumer = axiom.args[1].IRI;

                    for (leftInd in storage.get(leftOprop, null)) {
                        for (centerInd in storage.get(leftOprop, leftInd)) {
                            for (rightInd in storage.get(rightOprop, centerInd)) {
                                for (opropSubsumer in objectPropertySubsumers.get(chainSubsumer)) {
                                    if (!storage.exists(opropSubsumer, leftInd, rightInd)) {
                                        storage.add(opropSubsumer, leftInd, rightInd);
                                        changesHappened = true;
                                    }
                                }
                            }
                        }
                    }
                }
            } while (changesHappened);

            // Put object property assertions into the database.
            for (oprop in storage.get(null, null)) {
                if (!CONFIG.originalOntology.containsObjectProperty(oprop, JswOWL.IRIs)) {
                    continue;
                }

                for (leftInd in storage.get(oprop, null)) {
                    for (rightInd in storage.get(oprop, leftInd)) {
                        aBox.addObjectPropertyAssertion(oprop, leftInd, rightInd);
                    }
                }
            }
        }

        rewriteClassAssertions();
        rewriteObjectPropertyAssertions();

        return aBox;
    },

    /**
     * Answers the given user query.
     *
     * @param query An object representing a query to be answered.
     */
    answerQuery: function (query) {
        if (!query) {

            throw 'The query is not specified!';
        }

        //AJOUT Lionel
        //To separate SPARQL queries dedicated to ABoxes from class definitions
        if (query.triples.length !== 1) {
            throw 'Only one triple is currently allowed in sparql requests...';
        }

        //If the query is about class subsumption
        if (query.triples[0].predicate.value == CONFIG.rdf.IRIs.SUBCLASS) {
            var subject, object, subsumee, subsumer, result;

            result = [];
            subject = query.triples[0].subject.value;
            object = query.triples[0].object.value;

            //Find the variables in the subject and object
            for (var i = 0; i < query.variables.length; i++) {
                var variable = query.variables[i];
                if (variable.value == subject) {
                    subject = "*";
                }
                if (variable.value == object) {
                    object = "*";
                }
            }

            //Find the correct pairs in the classSubsumers Pairstorage...
            if (subject != "*") {
                //Looking for subsumers of the query subject
                for (subsumer in this.classSubsumers.storage[subject]) {
                    result.push({"subject": query.triples[0].subject.value, "object": subsumer});
                }
            } else {
                //Looking for subsumees
                for (subsumee in this.classSubsumers.storage) {
                    for (subsumer in this.classSubsumers.storage[subsumee]) {
                        if (object == "*" || object == subsumer) {
                            result.push({"subject": subsumee, "object": subsumer});
                        }
                    }
                }
            }
            return result;
        }

        return this.aBox.answerQuery(query);
    },

    /**
     * Normalizes the given ontology.
     *
     * @return jsw Ontology ontology which is a normalized version of the given one.
     */
    normalizeOntology: function (ontology) {
        var axiom, axiomIndex, queue, nothingClass, resultAxioms,
            rules, ruleCount, ruleIndex, instanceClasses;

        /**
         * Copies all entities from the source ontology to the result ontology.
         */
        function copyEntities() {
            var entities, entitiesOfType, entityIri, entityType;

            entities = ontology.entities;

            for (entityType in entities) {
                if (entities.hasOwnProperty(entityType)) {
                    entitiesOfType = entities[entityType];

                    for (entityIri in entitiesOfType) {
                        if (entitiesOfType.hasOwnProperty(entityIri)) {
                            CONFIG.resultOntology.entities[entityType][entityIri] =
                                entitiesOfType[entityIri];
                        }
                    }
                }
            }
        }

        /**
         * Creates a new entity of the given type with a unique IRI and registers it in the result
         * ontology.
         *
         * @param type Type of the entity to create.
         * @return Object representing the entity created.
         */
        function createEntity(type) {
            var newIri = CONFIG.resultOntology.createUniqueIRI(type);

            CONFIG.resultOntology.registerEntity(type, newIri, false);

            return {
                'type': type,
                'IRI': newIri
            };
        }

        /**
         * Returns nominal class object representing the given individual. If the class object
         * has not been created for the given individual, creates it.
         *
         * @param individual Object representing individual to return the nominal class for.
         * @return Nominal class object for the given individual.
         */
        function getIndividualClass(individual) {
            var individualIri, newClass;

            individualIri = individual.IRI;
            newClass = instanceClasses[individualIri];

            if (!newClass) {
                newClass = createEntity(JswOWL.ExpressionTypes.ET_CLASS);
                instanceClasses[individualIri] = newClass;
            }

            return newClass;
        }

        /**
         * For the given DisjointClasses axiom involving class expressions A1 .. An, puts an
         * equivalent set of axioms Ai n Aj <= {}, for all i <> j to the queue.
         *
         * @param statement DisjointClasses statement.
         * @param queue Queue to which the equivalent statements should be put.
         */
        function replaceDisjointClassesAxiom(statement, queue) {
            var args, argIndex1, argIndex2, firstArg, intersectType, nothing,
                resultAxiomType;

            resultAxiomType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;
            intersectType = JswOWL.ExpressionTypes.CE_INTERSECT;
            nothing = nothingClass;
            args = statement.args;

            for (argIndex1 = args.length; argIndex1--;) {
                firstArg = args[argIndex1];

                for (argIndex2 = argIndex1; argIndex2--;) {
                    queue.enqueue({
                        'type': resultAxiomType,
                        'args': [
                            {
                                'type': intersectType,
                                'args': [firstArg, args[argIndex2]]
                            },
                            nothing
                        ]
                    });
                }
            }
        }

        /**
         * For the given EquivalentClasses or EquivalentObjectProperties axiom involving expressions
         * A1 .. An, puts an equivalent set of all axioms Ai <= Aj to the given queue.
         *
         * @param axiom EquivalentClasses or EquivalentObjectProperties axiom.
         * @param resultAxiomType Type of the result axioms.
         * @param queue Queue to which the equivalent statements should be put.
         */
        function replaceEquivalenceAxiom(axiom, resultAxiomType, queue) {
            var args, argCount, argIndex1, argIndex2, firstArg;

            args = axiom.args;
            argCount = args.length;

            for (argIndex1 = argCount; argIndex1--;) {
                firstArg = args[argIndex1];

                for (argIndex2 = argCount; argIndex2--;) {
                    if (argIndex1 !== argIndex2) {
                        queue.enqueue({
                            type: resultAxiomType,
                            args: [firstArg, args[argIndex2]]
                        });
                    }
                }
            }
        }

        /**
         * For the given TransitiveObjectProperty for object property r, adds an equivalent axiom
         * r o r <= r to the given queue.
         *
         * @param axiom TransitiveObjectProperty axiom.
         * @param queue Queue to which the equivalent statements should be put.
         */
        function replaceTransitiveObjectPropertyAxiom(axiom, queue) {
            var oprop = axiom.objectProperty;

            queue.enqueue({
                'type': JswOWL.ExpressionTypes.AXIOM_OPROP_SUB,
                'args': [
                    {
                        'type': JswOWL.ExpressionTypes.OPE_CHAIN,
                        'args': [oprop, oprop]
                    },
                    oprop
                ]
            });
        }

        /**
         * For the given ClassAssertion statement in the form a <= A, where a is
         * individual and A is a class expression, puts the new statements a <= B and B <= A,
         * where B is a new atomic class, to the queue.
         *
         * @param statement ClassAssertion statement.
         * @param queue Queue to which the equivalent statements should be put.
         */
        function replaceClassAssertion(statement, queue) {
            var individual, newClass;

            individual = statement.individual;
            newClass = getIndividualClass(individual);

            queue.enqueue({
                'type': JswOWL.ExpressionTypes.AXIOM_CLASS_SUB,
                'args': [newClass, statement.classExpr]
            });
            queue.enqueue({
                'type': JswOWL.ExpressionTypes.FACT_CLASS,
                'individual': individual,
                'classExpr': newClass
            });
        }

        /**
         * For the given ObjectPropertyAssertion statement in the form r(a, b), where a and b are
         * individuals and r is an object property, adds axioms A <= E r.B to the given queue, where
         * A and B represent nominals {a} and {b}.
         *
         * @param statement ObjectPropertyAssertion statement.
         * @param queue Queue to which the equivalent statements should be put.
         */
        function replaceObjectPropertyAssertion(statement, queue) {
            queue.enqueue(statement);
            queue.enqueue({
                'type': JswOWL.ExpressionTypes.AXIOM_CLASS_SUB,
                'args': [getIndividualClass(statement.leftIndividual), {
                    'type': JswOWL.ExpressionTypes.CE_OBJ_VALUES_FROM,
                    'opropExpr': statement.objectProperty,
                    'classExpr': getIndividualClass(statement.rightIndividual)
                }]
            });
        }

        /**
         * Returns a queue with axioms which need to be normalized.
         */
        function createAxiomQueue() {
            var axiom, axioms, axiomIndex, classAssertion, disjointClasses, equivalentClasses,
                equivalentObjectProperties, objectPropertyAssertion, queue, subClassOf,
                subObjPropertyOf, transitiveObjectProperty;

            disjointClasses = JswOWL.ExpressionTypes.AXIOM_CLASS_DISJOINT;
            equivalentClasses = JswOWL.ExpressionTypes.AXIOM_CLASS_EQ;
            equivalentObjectProperties = JswOWL.ExpressionTypes.AXIOM_OPROP_EQ;
            subObjPropertyOf = JswOWL.ExpressionTypes.AXIOM_OPROP_SUB;
            subClassOf = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;
            transitiveObjectProperty = JswOWL.ExpressionTypes.AXIOM_OPROP_TRAN;
            classAssertion = JswOWL.ExpressionTypes.FACT_CLASS;
            objectPropertyAssertion = JswOWL.ExpressionTypes.FACT_OPROP;
            queue = new Queue();
            axioms = ontology.axioms;

            for (axiomIndex = axioms.length; axiomIndex--;) {
                axiom = axioms[axiomIndex];

                switch (axiom.type) {
                    case disjointClasses:
                        replaceDisjointClassesAxiom(axiom, queue);
                        break;
                    case equivalentClasses:
                        replaceEquivalenceAxiom(axiom, subClassOf, queue);
                        break;
                    case equivalentObjectProperties:
                        replaceEquivalenceAxiom(axiom, subObjPropertyOf, queue);
                        break;
                    case transitiveObjectProperty:
                        replaceTransitiveObjectPropertyAxiom(axiom, queue);
                        break;
                    case classAssertion:
                        replaceClassAssertion(axiom, queue);
                        break;
                    case objectPropertyAssertion:
                        replaceObjectPropertyAssertion(axiom, queue);
                        break;
                    default:
                        queue.enqueue(axiom);
                }
            }

            return queue;
        }

        instanceClasses = {};
        nothingClass = {
            'type': JswOWL.ExpressionTypes.ET_CLASS,
            'IRI': JswOWL.IRIs.NOTHING
        };

        rules = [
            /**
             * Checks if the given axiom is in the form P1 o P2 o ... o Pn <= P, where Pi and P are
             * object property expressions. If this is the case, transforms it into the set of
             * equivalent axioms
             *
             * P1 o P2 <= U1
             * U1 o P3 <= U2
             * ...
             * Un-2 o Pn <= P,
             *
             * where Ui are the new object properties introduced.
             *
             * @param axiom Axiom to apply the rule to.
             * @return (Object) {type: (exports.ExpressionTypes.AXIOM_OPROP_SUB|*), args: *[]}[] of axioms which are result of applying the rule to the given axiom or
             * null if the rule could not be applied.
             */
                function (axiom) {
                var lastOpropIndex, newOprop, normalized, opropChainType, opropIndex, opropType,
                    prevOprop, reqAxiomType, srcChain;

                opropChainType = JswOWL.ExpressionTypes.OPE_CHAIN;
                reqAxiomType = JswOWL.ExpressionTypes.AXIOM_OPROP_SUB;

                if (axiom.type !== reqAxiomType || axiom.args[0].type !== opropChainType ||
                    axiom.args[0].args.length <= 2) {
                    return null;
                }

                opropType = JswOWL.ExpressionTypes.ET_OPROP;
                prevOprop = createEntity(opropType);
                srcChain = axiom.args[0].args;

                normalized = [
                    {
                        type: reqAxiomType,
                        args: [
                            {
                                type: opropChainType,
                                args: [srcChain[0], srcChain[1]]
                            },
                            prevOprop
                        ]
                    }
                ];

                lastOpropIndex = srcChain.length - 1;

                for (opropIndex = 2; opropIndex < lastOpropIndex; opropIndex += 1) {
                    newOprop = createEntity(opropType);
                    normalized.push({
                        type: reqAxiomType,
                        args: [
                            {
                                type: opropChainType,
                                args: [prevOprop, srcChain[opropIndex]]
                            },
                            newOprop
                        ]
                    });

                    prevOprop = newOprop;
                }

                normalized.push({
                    type: reqAxiomType,
                    args: [
                        {
                            type: opropChainType,
                            args: [prevOprop, srcChain[lastOpropIndex]]
                        },
                        axiom.args[1]
                    ]
                });

                return normalized;
            },

            /**
             * Checks if the given axiom is in the form A <= A1 n A2 n ... An., where A and Ai are
             * class expressions. If this is the case, transforms it into the set of equivalent
             * axioms
             *
             * A <= A1
             * A <= A2
             * ...
             * A <= An
             * .
             *
             * @param axiom Axiom to apply the rule to.
             * @return Array of axioms which are result of applying the rule to the given axiom or
             * null if the rule could not be applied.
             */
                function (axiom) {
                var exprs, exprIndex, firstArg, normalized, reqAxiomType;

                reqAxiomType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;

                if (axiom.type !== reqAxiomType || axiom.args[1].type !== JswOWL.ExpressionTypes.CE_INTERSECT) {
                    return null;
                }

                exprs = axiom.args[1].args;

                normalized = [];
                firstArg = axiom.args[0];

                for (exprIndex = exprs.length; exprIndex--;) {
                    normalized.push({
                        type: reqAxiomType,
                        args: [firstArg, exprs[exprIndex]]
                    });
                }

                return normalized;
            },

            /**
             * Checks if the given axiom is in the form C <= D, where C and D are complex class
             * expressions. If this is the case, transforms the axiom into two equivalent axioms
             *
             * C <= A
             * A <= D
             *
             * where A is a new atomic class introduced.
             *
             * @param axiom Axiom to apply the rule to.
             * @return *[] of axioms which are result of applying the rule to the given axiom or
             * null if the rule could not be applied.
             */
                function (axiom) {
                var classType, newClassExpr, reqAxiomType;

                classType = JswOWL.ExpressionTypes.ET_CLASS;
                reqAxiomType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;

                if (axiom.type !== reqAxiomType || axiom.args[0].type === classType ||
                    axiom.args[1].type === classType) {
                    return null;
                }

                newClassExpr = createEntity(classType);

                return [
                    {
                        type: reqAxiomType,
                        args: [axiom.args[0], newClassExpr]
                    },
                    {
                        type: reqAxiomType,
                        args: [newClassExpr, axiom.args[1]]
                    }
                ];
            },

            /**
             * Checks if the given axiom is in the form C1 n C2 n ... Cn <= C, where some Ci are
             * complex class expressions. If this is the case converts the axiom into the set of
             * equivalent axioms
             *
             * Ci <= Ai
             * ..
             * C1 n ... n Ai n ... Cn <= C
             *
             * where Ai are new atomic classes introduced to substitute complex class expressions
             * Ci in the original axiom.
             *
             * @param axiom Axiom to try to apply the rule to.
             * @return Array of axioms which are result of applying the rule to the given axiom or
             * null if the rule could not be applied.
             */
                function (axiom) {
                var args, argIndex, classExpr, classType, newClassExpr, newIntersectArgs,
                    normalized, reqAxiomType, reqExprType, ruleApplied;

                reqAxiomType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;
                reqExprType = JswOWL.ExpressionTypes.CE_INTERSECT;
                classType = JswOWL.ExpressionTypes.ET_CLASS;

                if (axiom.type !== reqAxiomType || axiom.args[0].type !== reqExprType) {
                    return null;
                }

// All expressions in the intersection.
                args = axiom.args[0].args;

                normalized = [];
                newIntersectArgs = [];
                ruleApplied = false;

                for (argIndex = args.length; argIndex--;) {
                    classExpr = args[argIndex];

                    if (classExpr.type !== classType) {
                        ruleApplied = true;
                        newClassExpr = createEntity(classType);

                        normalized.push({
                            type: reqAxiomType,
                            args: [classExpr, newClassExpr]
                        });

                        newIntersectArgs.push(newClassExpr);
                    } else {
                        newIntersectArgs.push(classExpr);
                    }
                }

                if (ruleApplied) {
                    normalized.push({
                        type: reqAxiomType,
                        args: [
                            {
                                type: reqExprType,
                                args: newIntersectArgs
                            },
                            axiom.args[1]
                        ]
                    });

                    return normalized;
                } else {
                    return null;
                }
            },

            /**
             * Checks if the given axiom is in the form E P.A <= B, where A is a complex class
             * expression. If this is the case converts the axiom into two equivalent axioms
             * A <= A1 and E P.A1 <= B, where A1 is a new atomic class.
             *
             * @param axiom Axiom to try to apply the rule to.
             * @return *[] of axioms which are result of applying the rule to the given axiom or
             * null if the rule could not be applied.
             */
                function (axiom) {
                var firstArg, classType, newClassExpr, newObjSomeValuesExpr, reqAxiomType,
                    reqExprType;

                classType = JswOWL.ExpressionTypes.ET_CLASS;
                reqAxiomType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;
                reqExprType = JswOWL.ExpressionTypes.CE_OBJ_VALUES_FROM;

                if (axiom.type !== reqAxiomType || axiom.args[0].type !== reqExprType ||
                    axiom.args[0].classExpr.type === classType) {
                    return null;
                }

                firstArg = axiom.args[0];

                newClassExpr = createEntity(classType);

                newObjSomeValuesExpr = {
                    'type': reqExprType,
                    'opropExpr': firstArg.opropExpr,
                    'classExpr': newClassExpr
                };

                return [
                    {
                        'type': reqAxiomType,
                        'args': [firstArg.classExpr, newClassExpr]
                    },
                    {
                        'type': reqAxiomType,
                        'args': [newObjSomeValuesExpr, axiom.args[1]]
                    }
                ];
            },

            /**
             * Checks if the given axiom is in the form A <= E P.B, where B is a complex class
             * expression. If this is the case converts the axiom into two equivalent axioms
             * B1 <= B and A <= E P.B1, where B1 is a new atomic class.
             *
             * @param axiom Axiom to try to apply the rule to.
             * @return *[] of axioms which are result of applying the rule to the given axiom or
             * null if the rule could not be applied.
             */
                function (axiom) {
                var classType, newClassExpr, reqAxiomType, reqExprType, secondArg;

                classType = JswOWL.ExpressionTypes.ET_CLASS;
                reqAxiomType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;
                reqExprType = JswOWL.ExpressionTypes.CE_OBJ_VALUES_FROM;

                if (axiom.type !== reqAxiomType || axiom.args[1].type !== reqExprType ||
                    axiom.args[1].classExpr.type === classType) {
                    return null;
                }

                secondArg = axiom.args[1];

                newClassExpr = createEntity(classType);

                return [
                    {
                        'type': reqAxiomType,
                        'args': [newClassExpr, secondArg.classExpr]
                    },
                    {
                        'type': reqAxiomType,
                        'args': [axiom.args[0], {
                            'type': reqExprType,
                            'opropExpr': secondArg.opropExpr,
                            'classExpr': newClassExpr
                        }]
                    }
                ];
            },

            /**
             * Checks if the given statement is an axiom of the form Nothing <= A. If this is the
             * case, removes the axiom from the knowledge base (the axiom states an obvious thing).
             *
             * @param statement Statement to try to apply the rule to.
             * @return Array of statements which are the result of applying the rule to the given
             * statement or null if the rule could not be applied.
             */
                function (statement) {
                var firstArg;

                if (statement.type !== JswOWL.ExpressionTypes.AXIOM_CLASS_SUB) {
                    return null;
                }

                firstArg = statement.args[0];

                if (firstArg.type === JswOWL.ExpressionTypes.ET_CLASS && firstArg.IRI === JswOWL.IRIs.NOTHING) {
                    return [];
                }

                return null;
            }
        ];

// MAIN ALGORITHM

// Copy all entities from the source to the destination ontology first.
        copyEntities();

        queue = createAxiomQueue();
        ruleCount = rules.length;

        while (!queue.isEmpty()) {
            axiom = queue.dequeue();

            // Trying to find a rule to apply to the axiom.
            for (ruleIndex = ruleCount; ruleIndex--;) {
                resultAxioms = rules[ruleIndex](axiom);

                if (resultAxioms !== null) {
                    // If applying the rule succeeded.
                    for (axiomIndex = resultAxioms.length; axiomIndex--;) {
                        queue.enqueue(resultAxioms[axiomIndex]);
                    }

                    break;
                }
            }

            if (ruleIndex < 0) {
                // If nothing can be done to the axiom, it is returned unchanged by all rule
                // functions and the axiom is in one of the normal forms already.
                CONFIG.resultOntology.axioms.push(axiom);
            }
        }

        return CONFIG.resultOntology;
    }
};

/** Allows to work with SQL representation of queries against RDF data. */
var TrimQueryABox = function () {
    /** The object storing ABox data. */
    this.database = {
        ClassAssertion: [],
        ObjectPropertyAssertion: []
    };

    /** The object which can be used to send queries against ABoxes. */
    this.queryLang = this.createQueryLang();
};

/** Prototype for all jsw.TrimQueryABox objects. */
TrimQueryABox.prototype = {
    /**
     * Answers the given RDF query.
     *
     * @param query RDF query to answer.
     * @return Data set containing the results matching the query.
     */
    answerQuery: function (query) {
        var sql = this.createSql(query);

        try {
            return this.queryLang.parseSQL(sql).filter(this.database);
        } catch (ex) {
            /* Recreate the query language object, since the previous object can not be used now.*/
            this.queryLang = this.createQueryLang();
            throw ex;
        }
    },

    /**
     * Adds a class assertion to the database.
     *
     * @param individualIri IRI of the individual in the assertion.
     * @param classIri IRI of the class in the assertion.
     */
    addClassAssertion: function (individualIri, classIri) {
        this.database.ClassAssertion.push({
            individual: individualIri,
            className: classIri
        });
    },

    /**
     * Adds an object property assertion to the database.
     *
     * @param objectPropertyIri IRI of the object property in the assertion.
     * @param leftIndIri IRI of the left individual in the assertion.
     * @param rightIndIri IRI of the right individual in the assertion.
     */
    addObjectPropertyAssertion: function (objectPropertyIri, leftIndIri, rightIndIri) {
        this.database.ObjectPropertyAssertion.push({
            objectProperty: objectPropertyIri,
            leftIndividual: leftIndIri,
            rightIndividual: rightIndIri
        });
    },

    /**
     * Creates an object which can be used for sending queries against the database.
     *
     * @return Object which can be used for sending queries against the database.
     */
    createQueryLang: function () {
        return TrimPath.makeQueryLang({
            ClassAssertion : { individual : { type: 'String' },
                className : { type: 'String' }},
            ObjectPropertyAssertion : { objectProperty : { type: 'String' },
                leftIndividual : { type: 'String' },
                rightIndividual : { type: 'String' }}
        });
    },

    /**
     * Returns an SQL representation of the given RDF query.
     *
     * @param query jsw.rdf.Query to return the SQL representation for.
     * @return string representation of the given RDF query.
     */
    createSql: function (query) {
        var from, limit, objectField, orderBy, predicate, predicateType, predicateValue, rdfTypeIri, /* AJOUT Lionel subClassOfIri, */
            select, subjectField, table, triple, triples, tripleCount, tripleIndex, variable, vars, varCount, varField, varFields, varIndex, where;

        from = '';
        where = '';
        rdfTypeIri = rdf.IRIs.TYPE;
//AJOUT Lionel
//subClassOfIri = jsw.rdf.IRIs.SUBCLASS;

        varFields = {};

        /** Appends a condition to the where clause based on the given expression.
         *

         * @param expr Expression to use for constructing a condition.
         * @param table Name of the table corresponding to the expression.
         * @param field Name of the field corresponding to the expression.
         */
        function writeExprCondition(expr, table, field) {
            var type = expr.type,
                value = expr.value,
                varField;

            if (type === rdf.ExpressionTypes.IRI_REF) {
                where += table + '.' + field + "=='" + value + "' AND ";
            } else if (type === rdf.ExpressionTypes.VAR) {
                varField = varFields[value];

                if (varField) {
                    where += table + '.' + field + '==' + varField + ' AND ';
                } else {
                    varFields[value] = table + '.' + field;
                }
            } else if (type === rdf.ExpressionTypes.LITERAL) {
                throw 'Literal expressions in RDF queries are not supported by the library yet!';
            } else {
                throw 'Unknown type of expression found in the RDF query: ' + type + '!';
            }
        }

        triples = query.triples;
        tripleCount = triples.length;

        for (tripleIndex = 0; tripleIndex < tripleCount; tripleIndex += 1) {
            triple = triples[tripleIndex];

            predicate = triple.predicate;
            predicateType = predicate.type;
            predicateValue = predicate.value;
            subjectField = 'leftIndividual';
            objectField = 'rightIndividual';
            table = 't' + tripleIndex;


            if (predicateType === rdf.ExpressionTypes.IRI_REF) {
                if (predicateValue === rdfTypeIri) {
                    from += 'ClassAssertion AS ' + table + ', ';
                    subjectField = 'individual';
                    objectField = 'className';

//AJOUT Lionel (pour le traitement des requêtes de subsomption de classes
                    /*
                     } else if (predicateValue === subClassOfIri) {
                     from += 'ClassAssertion AS ' + table + ', ';
                     subjectField = 'leftclassName';
                     objectField = 'rightclassName';
                     */

                } else {
                    from += 'ObjectPropertyAssertion AS ' + table + ', ';
                    where += table + ".objectProperty=='" + predicateValue + "' AND ";
                }
            } else if (predicateType === rdf.ExpressionTypes.VAR) {
                from += 'ObjectPropertyAssertion AS ' + table + ', ';
                varField = varFields[predicateValue];

                if (varField) {
                    where += table + '.objectProperty==' + varField + ' AND ';
                } else {
                    varFields[predicateValue] = table + '.objectProperty';
                }
            } else {
                throw 'Unknown type of a predicate expression: ' + predicateType + '!';
            }

            writeExprCondition(triple.subject, table, subjectField);
            writeExprCondition(triple.object, table, objectField);
        }

        if (tripleCount > 0) {
            from = ' FROM ' + from.substring(0, from.length - 2);
        }

        if (where.length > 0) {
            where = ' WHERE ' + where.substring(0, where.length - 5);
        }

        select = '';
        vars = query.variables;
        varCount = vars.length;

        if (varCount > 0) {
            for (varIndex = 0; varIndex < varCount; varIndex += 1) {
                variable = vars[varIndex].value;
                varField = varFields[variable];

                if (varField) {
                    select += varField + ' AS ' + variable + ', ';
                } else {
                    select += "'' AS " + variable + ', ';
                }
            }
        } else {
            for (variable in varFields) {
                if (varFields.hasOwnProperty(variable)) {
                    select += varFields[variable] + ' AS ' + variable + ', ';
                }
            }
        }

        if (select.length > 0) {
            select = select.substring(0, select.length - 2);
        } else {
            throw 'The given RDF query is in the wrong format!';
        }

        if (query.distinctResults) {
            select = 'SELECT DISTINCT ' + select;
        } else {
            select = 'SELECT ' + select;
        }

        orderBy = '';
        vars = query.orderBy;
        varCount = vars.length;

        for (varIndex = 0; varIndex < varCount; varIndex += 1) {
            variable = vars[varIndex];

            if (variable.type !== rdf.ExpressionTypes.VAR) {
                throw 'Unknown type of expression found in ORDER BY: ' + variable.type + '!';
            }

            orderBy += variable.value + ' ' + variable.order + ', ';
        }

        if (varCount > 0) {
            orderBy = ' ORDER BY ' + orderBy.substring(0, orderBy.length - 2);
        }

        limit = '';

        if (query.limit !== 0) {

            limit = ' LIMIT ';
            if (query.offset !== 0) {
                limit += query.offset + ', ';
            }
            limit += query.limit;
        } else if (query.offset !== 0) {
            limit = ' LIMIT ' + query.offset + ', ALL';
        }

        return select + from + where + orderBy + limit;
    }
};
/**
 * TrimPath Query. Release 1.1.14.
 * Copyright (C) 2004 - 2007 TrimPath.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA.
 */
if (typeof(TrimPath) == 'undefined')
    TrimPath = {};

(function() { // Using a closure to keep global namespace clean.
    var theEval   = eval;
    var theString = String;
    var theArray  = Array;

    TrimPath.TEST = TrimPath.TEST || {}; // For exposing to testing only.

    var arrayUniq = function(arr) {
        var result = [];
        for (var i = 0; i < arr.length; i++) {
            if (arrayInclude(result, arr[i]) == false)
                result.push(arr[i]);
        }
        return result;
    };

    var arrayInclude = function(arr, val) {
        for (var j = 0; j < arr.length; j++) {
            if (arr[j] == val)
                return true;
        }
        return false;
    }

    var arrayCompact = function(arr) {
        var result = [];
        for (var i = 0; i < arr.length; i++)
            if (arr[i] != null)
                result.push(arr[i])
        return result;
    }

    var simpleJson = function(fields, values) { // The fields and values are arrays of strings.
        var json = [ '{' ];
        for (var i=0; i<fields.length; i++) {
            if (i > 0)
                json.push(',');
            json.push(fields[i]);
            json.push(':');
            if (values[i]) {
                json.push('"');
                json.push(values[i].replace(/(["\\])/g, '\\$1').replace(/\r/g, '').replace(/\n/g, '\\n'));
                json.push('"');
            } else
                json.push(null);
        }
        json.push('}');
        return json.join('');
    }

    var hashKeys = function(object) {
        var keys = [];
        for (var property in object)
            keys.push(property);
        return keys;
    }

    var hashValues = function(object) {
        var values = [];
        for (var property in object)
            values.push(object[property]);
        return values;
    }

    var strip = function(str) {
        return str.replace(/^\s+/, '').replace(/\s+$/, '');
    }

    TrimPath.makeQueryLang_etc = {};
    TrimPath.makeQueryLang_etc.Error = function(message, stmt) { // The stmt can be null, a String, or an Object.
        this.message = message;
        this.stmt    = stmt;
    }
    TrimPath.makeQueryLang_etc.Error.prototype.toString = function() {
        return ("TrimPath query Error in " + (this.stmt != null ? this.stmt : "[unknown]") + ": " + this.message);
    }

    var TODO  = function() { throw "currently unsupported"; };
    var USAGE = function() { throw "incorrect keyword usage"; };

    var QueryLang = function() {};

    TrimPath.makeQueryLang = function(tableInfos, etc) {
        if (etc == null)
            etc = TrimPath.makeQueryLang_etc;

        var aliasArr = []; // Used after SELECT to clean up the queryLang for reuse.
        var aliasReg = function(aliasKey, scope, obj) {
            if (scope[aliasKey] != null)
                throw new etc.Error("alias redefinition: " + aliasKey);
            aliasArr.push({ aliasKey: aliasKey, scope: scope, orig: scope[aliasKey] });
            scope[aliasKey] = obj;
            return obj;
        };

        var queryLang = new QueryLang();

        var checkArgs = function(args, minLength, maxLength, name, typeCheck) {
            args = cleanArray(args);
            if (minLength == null)
                minLength = 1;
            if (args == null || args.length < minLength)
                throw new etc.Error("not enough arguments for " + name);
            if (maxLength != null && args.length > maxLength)
                throw new etc.Error("too many arguments for " + name);
            if (typeCheck != null)
                for (var k in args)
                    if (typeof(args[k]) != "function" && // Ignore functions because other libraries like to extend Object.prototype.
                        args[k] instanceof typeCheck == false)
                        throw new etc.Error("wrong type for " + args[k] + " to " + name);
            return args;
        }

        var sql_date_to_js_date = function(data) {
            if(typeof data == "string" && data.match(/\d{4}-\d{1,2}-\d{1,2}/)) {
                var dateArr = data.match(/\d{4}-\d{1,2}-\d{1,2}/)[0].split('-');
                var date = new Date(parseInt(dateArr[0], 10), (parseInt(dateArr[1], 10)-1), parseInt(dateArr[2], 10));
                return date;
            }
            return data;
        }

        var data_insertion = function(table_info, field_name, data, column_ref) {
            if(table_info[field_name]) {
                var data = eval(data);
                if(table_info[field_name].type && table_info[field_name].type == 'Number')
                    data = Number(data, 10);
                else if(table_info[field_name].type && table_info[field_name].type == 'Date')
                    data = sql_date_to_js_date(data);
                column_ref[field_name] = data;
            }
        }

        var NodeType = { // Constructor functions for SELECT statement tree nodes.
            select : function(args) {
                var columns = [];
                var nodes = { from : null, where : null, groupBy : null, having : null, orderBy : null,
                    limit : null };

                for (var i = 0; i < args.length; i++) { // Parse args into columns and nodes.
                    var arg = args[i];
                    var argIsNode = false;
                    for (var nodeTypeName in nodes) {
                        if (arg instanceof NodeType[nodeTypeName]) {
                            if (nodes[nodeTypeName] != null)
                                throw new etc.Error("too many " + nodeTypeName.toUpperCase() + " clauses");
                            nodes[nodeTypeName] = arg;
                            argIsNode = true;
                            break;
                        }
                    }
                    if (argIsNode == false) // Then the arg must be a column.
                        columns.push(arg);
                }
                columns = checkArgs(columns, 1, null, "COLUMNS");
                if (nodes.from == null)
                    throw new etc.Error("missing FROM clause");

                var joinDriver        = null;
                var joinFilter        = null;
                var whereFilter       = null;
                var columnConvertor   = null;
                var orderByComparator = null;
                var groupByCalcValues = null;
                var havingFilter      = null;

                var typeConverter = function(results) {
                    for(var i=0; i<results.length; i++) {
                        var result = results[i];
                        for(var attr in result) {
                            var value = result[attr];
                            if(value instanceof Date)
                                results[i][attr] = dateToString(value);
                        }
                    }
                }

                this.prepareFilter = function() {
                    if (joinDriver == null)
                        joinDriver = compileJoinDriver(nodes.from.tables);
                    if (joinFilter == null)
                        joinFilter = compileFilter(compileFilterForJoin, nodes.from.tables);
                    if (whereFilter == null)
                        whereFilter = compileFilter(compileFilterForWhere, nodes.from.tables, nodes.where != null ? nodes.where.exprs : null);
                    if (groupByCalcValues == null && nodes.groupBy != null)
                        groupByCalcValues = compileGroupByCalcValues(nodes.from.tables, nodes.groupBy.exprs);
                    if (havingFilter == null && nodes.having != null)
                        havingFilter = compileFilter(compileFilterForWhere, [], nodes.having.exprs, { aliasOnly : true });
                    if (columnConvertor == null)
                        columnConvertor = compileColumnConvertor(nodes.from.tables, columns);
                    if (orderByComparator == null && nodes.orderBy != null)
                        orderByComparator = compileOrderByComparator(nodes.orderBy.exprs);
                }

                /* params is a list of parameters including:
                 * with_table: if set to true, the results will include table_name+'.'+field_name
                 * return_reference: used by update and delete queries, if set to true, returns reference of data rather than copies,
                 *                   returns the result of the joinDriver
                 */
                this.filter = function(dataTables, bindings, params) {
                    this.prepareFilter();
                    if (bindings == null)
                        bindings = {};
                    if (params == null)
                        params = {};

                    var resultOfFromWhere = joinDriver(dataTables, joinFilter, whereFilter, bindings);

                    if (groupByCalcValues != null) {
                        for (var i = 0; i < resultOfFromWhere.length; i++)
                            resultOfFromWhere[i].groupByValues = groupByCalcValues.apply(null, resultOfFromWhere[i]);
                        resultOfFromWhere.sort(groupByComparator);
                    }

                    if (params.return_reference)
                        return resultOfFromWhere;

                    var groupByAccum = {}; // Accumlation area for aggregate functions.
                    var groupByFuncs = {
                        SUM : function(key, val) {
                            groupByAccum[key] = zeroDefault(groupByAccum[key]) + zeroDefault(val);
                            return groupByAccum[key];
                        },
                        COUNT : function(key) {
                            groupByAccum[key] = zeroDefault(groupByAccum[key]) + 1;
                            return groupByAccum[key];
                        },
                        AVG : function(key, val) {
                            return groupByFuncs.SUM(key, val) / groupByFuncs.COUNT("_COUNT" + key);
                        }
                    };

                    var result = [], prevItem = null, currItem;
                    for (var i = 0; i < resultOfFromWhere.length; i++) {
                        currItem    = resultOfFromWhere[i];
                        currItem[0] = groupByFuncs;
                        if (prevItem != null &&
                            groupByComparator(prevItem, currItem) != 0) {
                            if (havingFilter == null ||
                                havingFilter(prevItem.record) == true)
                                result.push(prevItem.record);
                            groupByAccum = {};
                        }
                        currItem.record = columnConvertor.apply(null, currItem.concat([params.with_table])); // Must visit every item to calculate aggregates.
                        prevItem = currItem;
                    }
                    if (prevItem != null &&
                        (havingFilter == null ||
                            havingFilter(prevItem.record) == true))
                        result.push(prevItem.record);

                    if (orderByComparator != null)
                        result.sort(orderByComparator);
                    if (nodes.limit != null) {
                        if (nodes.limit.total == 0)
                            return [];
                        var start = (nodes.limit.offset != null ? nodes.limit.offset : 0);
                        result = result.slice(start, start + (nodes.limit.total > 0 ? nodes.limit.total : result.length));
                    }

                    typeConverter(result)
                    return result;
                }

                setSSFunc(this, function() {
                    var sqlArr = [ "SELECT", map(columns, toSqlWithAlias).join(", "), nodes.from.toSql() ];
                    if (nodes.where != null)
                        sqlArr.push(nodes.where.toSql());
                    if (nodes.groupBy != null)
                        sqlArr.push(nodes.groupBy.toSql());
                    if (nodes.having != null)
                        sqlArr.push(nodes.having.toSql());
                    if (nodes.orderBy != null)
                        sqlArr.push(nodes.orderBy.toSql());
                    if (nodes.limit != null)
                        sqlArr.push(nodes.limit.toSql());
                    return sqlArr.join(" ");
                });

                for (var i = 0; i < aliasArr.length; i++) { // TODO: In nested select, parent's aliases are incorrectly reset.
                    var aliasItem = aliasArr[i];
                    aliasItem.scope[aliasItem.aliasKey] = aliasItem.orig;
                }
                aliasArr = [];
            },
            insert  : function(args) {
                var table_info = args[0];
                var object = args[1];
                this.filter  = function(dataTables, bindings) {
                    var table_name = table_info['.name'];
                    if(!dataTables[table_name])
                        dataTables[table_name] = [];
                    dataTables[table_name].push({});
                    for(var field_name in object) {
                        data_insertion(table_info, field_name, object[field_name], dataTables[table_name][dataTables[table_name].length-1]);
                    }
                    return true;
                }

                setSSFunc(this, function() {
                    var sqlArr = [ "INSERT INTO", table_info.toSql(), '('+hashKeys(object).join(', ')+')',
                        'VALUES', '('+hashValues(object).join(', ')+')' ];
                    return sqlArr.join(" ");
                });
            },
            update  : function(args) {
                var from_node   = args[0];
                var assignments = args[1];
                var where_node  = args[2];
                this.filter  = function(dataTables, bindings) {
                    var table_info = from_node.tables[0];
                    var resultOfFromWhere = queryLang.SELECT(from_node, where_node, 1).filter(dataTables, null, {return_reference: true});
                    for (var i = 0; i < resultOfFromWhere.length; i++) {
                        var object = resultOfFromWhere[i][1];
                        for(var field in assignments) {
                            var fieldSplit = field.split('.');
                            var field_name = field;
                            if(fieldSplit.length == 2)
                                field_name = fieldSplit[1];
                            data_insertion(table_info, field_name, assignments[field], object);
                        }
                    }
                    return true;
                }

                setSSFunc(this, function() {
                    var sqlArr = [ "UPDATE", from_node.toSql() ];
                    var assignmentsArr = [];
                    for(var attr in assignments) {
                        assignmentsArr.push(attr+'='+assignments[attr])
                    }
                    sqlArr.push(assignmentsArr.join(', '));
                    if (where_node != null)
                        sqlArr.push(where_node.toSql());
                    return sqlArr.join(" ");
                });
            },
            destroy  : function(args) {
                var select_node = args[0];
                this.filter  = function(dataTables, bindings) {
                    var resultOfFromWhere = select_node.filter(dataTables, null, {return_reference: true});
                    // now go through each object, go through each attribute of it and delete it
                    for (var i = 0; i < resultOfFromWhere.length; i++) {
                        var record = resultOfFromWhere[i];
                        for(var j=1; j<record.length; j++) {
                            var object = record[j];
                            for(var attr in object) {
                                delete object[attr];
                            }
                        }
                    }
                    // then go through each table in the dataTables, each record, deleting any records that are empty objects
                    for(var table_name in dataTables) {
                        var table = dataTables[table_name]
                        for(var i = 0; i<table.length; i++) {
                            if(hashKeys(table[i]).length == 0)
                                delete table[i];
                        }
                    }
                    // then compact each table and save it back as itself
                    for(var table_name in dataTables) {
                        dataTables[table_name] = arrayCompact(dataTables[table_name]);
                    }

                    return true;
                }

                setSSFunc(this, function() {
                    var sqlArr = [ "DELETE", select_node.toSql() ];
                    return sqlArr.join(" ").replace(/SELECT\s/, '');
                });
            },
            from    : function(tables) { this.tables = checkArgs(tables, 1, null, "FROM",   NodeType.tableDef); },
            where   : function(exprs)  { this.exprs  = checkArgs(exprs,  1, null, "WHERE",  NodeType.expression); },
            groupBy : function(exprs)  { this.exprs  = checkArgs(exprs,  1, null, "GROUP_BY"); },
            having  : function(exprs)  { this.exprs  = checkArgs(exprs,  1, null, "HAVING", NodeType.expression); },
            orderBy : function(exprs)  { this.exprs  = checkArgs(exprs,  1, null, "ORDER_BY"); },
            expression : function(args, name, opFix, sqlText, minArgs, maxArgs, jsText, alias) {
                var theExpr    = this;
                this.args      = checkArgs(args, minArgs, maxArgs, name);
                this[".name"]  = name;
                this[".alias"] = alias != null ? alias : name;
                this.opFix     = opFix;
                this.sqlText   = sqlText != null ? sqlText : this[".name"];
                this.jsText    = jsText != null ? jsText : this.sqlText;
                this.AS = function(aliasArg) {
                    this[".alias"] = this.ASC[".alias"] = this.DESC[".alias"] = aliasArg;
                    return aliasReg(aliasArg, queryLang, this);
                }
                this.ASC  = setSSFunc({ ".name": name, ".alias": theExpr[".alias"], order: "ASC" },
                    function() { return theExpr[".alias"] + " ASC"; });
                this.DESC = setSSFunc({ ".name": name, ".alias": theExpr[".alias"], order: "DESC" },
                    function() { return theExpr[".alias"] + " DESC"; });
                this.COLLATE = TODO;
            },
            aggregate : function() {
                NodeType.expression.apply(this, arguments);
            },
            limit : function(offset, total) {
                if(total == null) { // if only one parameter, it is the total
                    this.total  = cleanString(offset);
                } else {
                    this.total  = cleanString(total);
                    this.offset = cleanString(offset);
                }
            },
            tableDef : function(name, columnInfos, alias) {
                this[".name"]  = name;
                this[".alias"] = alias != null ? alias : name;
                this[".allColumns"] = [];
                for (var columnName in columnInfos) {
                    this[columnName] = new NodeType.columnDef(columnName, columnInfos[columnName], this);
                    this[".allColumns"].push(this[columnName]);
                }
                setSSFunc(this, function() { return name; });
                this.AS = function(alias) {
                    return aliasReg(alias, queryLang, new NodeType.tableDef(name, columnInfos, alias));
                }
                this.ALL    = new NodeType.columnDef("*", null, this);
                this.ALL.AS = null; // SELECT T.* AS X FROM T is not legal.
            },
            columnDef : function(name, columnInfo, tableDef, alias) { // The columnInfo & tableDef might be null.
                var theColumnDef = this;
                this[".name"]  = name;
                this[".alias"] = alias != null ? alias : name;
                this.tableDef = tableDef;
                setSSFunc(this, function(flags) {
                    if (flags != null && flags.aliasOnly == true)
                        return this[".alias"];
                    return tableDef != null ? ((tableDef[".alias"]) + "." + name) : name;
                });
                this.AS = function(aliasArg) {
                    return aliasReg(aliasArg, queryLang, new NodeType.columnDef(name, columnInfo, tableDef, aliasArg));
                }
                if(columnInfo && columnInfo.type)
                    this.type = columnInfo.type
                else
                    this.type = "String";
                this.ASC  = setSSFunc({ ".name": name, ".alias": theColumnDef[".alias"], tableDef: tableDef, order: "ASC" },
                    function() { return theColumnDef.toSql() + " ASC"; });
                this.DESC = setSSFunc({ ".name": name, ".alias": theColumnDef[".alias"], tableDef: tableDef, order: "DESC" },
                    function() { return theColumnDef.toSql() + " DESC"; });
                this.COLLATE = TODO;
            },
            join : function(joinType, tableDef) {
                var theJoin        = this;
                this.joinType      = joinType;
                this.fromSeparator = " " + joinType + " JOIN ";
                for (var k in tableDef)
                    this[k] = tableDef[k];
                this.ON    = function() { theJoin.ON_exprs    = checkArgs(arguments, 1, null, "ON"); return theJoin; };
                this.USING = function() { theJoin.USING_exprs = cleanArray(arguments, false);        return theJoin; };
                this.fromSuffix = function() {
                    if (theJoin.ON_exprs != null)
                        return (" ON " + map(theJoin.ON_exprs, toSql).join(" AND "));
                    if (theJoin.USING_exprs != null)
                        return (" USING (" + theJoin.USING_exprs.join(", ") + ")");
                    return "";
                }
            }
        }

        var setSSFunc = function(obj, func) { obj.toSql = obj.toJs = obj.toString = func; return obj; };

        setSSFunc(NodeType.from.prototype, function() {
            var sqlArr = [ "FROM " ];
            for (var i = 0; i < this.tables.length; i++) {
                if (i > 0) {
                    var sep = this.tables[i].fromSeparator;
                    if (sep == null)
                        sep = ", "
                    sqlArr.push(sep);
                }
                sqlArr.push(toSqlWithAlias(this.tables[i]));
                if (this.tables[i].fromSuffix != null)
                    sqlArr.push(this.tables[i].fromSuffix());
            }
            return sqlArr.join("");
        });

        setSSFunc(NodeType.where.prototype,   function() { return "WHERE "    + map(this.exprs,  toSql).join(" AND "); });
        setSSFunc(NodeType.orderBy.prototype, function() { return "ORDER BY " + map(this.exprs,  toSql).join(", "); });
        setSSFunc(NodeType.groupBy.prototype, function() { return "GROUP BY " + map(this.exprs,  toSql).join(", "); });
        setSSFunc(NodeType.having.prototype,  function() { return "HAVING "   + map(this.exprs,  toSql, { aliasOnly : true }).join(" AND "); });
        setSSFunc(NodeType.limit.prototype,   function() { return "LIMIT " + (this.total < 0 ? "ALL" : this.total) +
            (this.offset != null ? (" OFFSET " + this.offset) : ""); });

        var makeToFunc = function(toFunc, opText) {
            return function(flags) {
                if (flags != null && flags.aliasOnly == true && this[".alias"] != this[".name"])
                    return this[".alias"];
                if (this.opFix < 0) // prefix
                    return this[opText] + " (" + map(this.args, toFunc, flags).join(") " + this[opText] + " (") + ")";
                if (this.opFix > 0) // suffix
                    return "(" + map(this.args, toFunc, flags).join(") " + this[opText] + " (") + ") " + this[opText];
                return "(" + map(this.args, toFunc, flags).join(") " + this[opText] + " (") + ")"; // infix
            }
        }

        NodeType.expression.prototype.toSql = makeToFunc(toSql, "sqlText");
        NodeType.expression.prototype.toJs  = makeToFunc(toJs,  "jsText");

        NodeType.aggregate.prototype      = new NodeType.expression([], null, null, null, 0);
        NodeType.aggregate.prototype.toJs = function(flags) {
            if (flags != null && flags.aliasOnly == true && this[".alias"] != this[".name"])
                return this[".alias"];
            return this.jsText + " ('" + this[".alias"] + "', (" + map(this.args, toJs).join("), (") + "))";
        }

        NodeType.join.prototype = new NodeType.tableDef();

        NodeType.whereSql = function(sql) { this.exprs = [ new NodeType.rawSql(sql) ]; };
        NodeType.whereSql.prototype = new NodeType.where([new NodeType.expression([0], null, 0, null, 0, null, null, null)]);

        NodeType.havingSql = function(sql) { this.exprs = [ new NodeType.rawSql(sql) ]; };
        NodeType.havingSql.prototype = new NodeType.having([new NodeType.expression([0], null, 0, null, 0, null, null, null)]);

        NodeType.rawSql = function(sql) { this.sql = sql; }
        NodeType.rawSql.prototype.toSql = function(flags) { return this.sql; }
        NodeType.rawSql.prototype.toJs = function(flags) {
            var js = this.sql;
            js = js.replace(/ AND /g, " && ");
            js = js.replace(/ OR /g, " || ");
            js = js.replace(/ = /g, " == ");
            js = js.replace(/ IS NULL/g, " == null");
            js = js.replace(/ IS NOT NULL/g, " != null");
            js = js.replace(/ NOT /g, " ! ");

            var LIKE_regex = /(\S+)\sLIKE\s'(\S+)'/g;
            var matchArr;
            while(matchArr = LIKE_regex.exec(js) ) {
                matchArr[2] = matchArr[2].replace(/%/, '.*');
                js = js.replace(LIKE_regex, "$1.match(/"+matchArr[2]+"/)");
            }

            // replace date-like strings with date object constructor
            var DATE_regex = /'(\d{4})-(\d{1,2})-(\d{1,2})'/g;
            while(matchArr = DATE_regex.exec(js) ) {
                var dateArr = [parseInt(matchArr[1], 10).toString(), (parseInt(matchArr[2], 10)-1).toString(), parseInt(matchArr[3], 10).toString()];
                var replacement = '(new Date('+dateArr.join(', ')+').valueOf())';
                js = js.replace(matchArr[0], replacement);
            }

            // NOTE: The following messes up IS NULL queries. -- steve.yen
            // >>> // replace all table+'.'+column with valueOf()
            // >>> js = js.replace(/(\w+\.\w+)/g, "$1 && $1.valueOf()");

            return js;
        }

        var keywords = {
            INSERT  :   function() { return new NodeType.insert(arguments); },
            UPDATE  :   function() { return new NodeType.update(arguments); },
            DESTROY  :   function() { return new NodeType.destroy(arguments); },
            SELECT_ALL      : function() { return new NodeType.select(arguments); },
            SELECT_DISTINCT : TODO,
            ALL   : USAGE, // We use ALL in different syntax, like SELECT_ALL.
            FROM  : function() { return new NodeType.from(arguments); },
            WHERE : function() { return new NodeType.where(arguments); },
            AND   : function() { return new NodeType.expression(arguments, "AND",  0, null, 1, null, "&&"); },
            OR    : function() { return new NodeType.expression(arguments, "OR",   0, null, 1, null, "||"); },
            NOT   : function() { return new NodeType.expression(arguments, "NOT", -1, null, 1, 1, "!"); },
            EQ    : function() { return new NodeType.expression(arguments, "EQ",   0, "=",  2, 2, "=="); },
            NEQ   : function() { return new NodeType.expression(arguments, "NEQ",  0, "!=", 2, 2); },
            LT    : function() { return new NodeType.expression(arguments, "LT",   0, "<",  2, 2); },
            GT    : function() { return new NodeType.expression(arguments, "GT",   0, ">",  2, 2); },
            LTE   : function() { return new NodeType.expression(arguments, "LTE",  0, "<=", 2, 2); },
            GTE   : function() { return new NodeType.expression(arguments, "GTE",  0, ">=", 2, 2); },
            IS_NULL     : function() { return new NodeType.expression(arguments, "IS_NULL",     1, "IS NULL",     1, 1, "== null"); },
            IS_NOT_NULL : function() { return new NodeType.expression(arguments, "IS_NOT_NULL", 1, "IS NOT NULL", 1, 1, "!= null"); },
            ADD         : function() { return new NodeType.expression(arguments, "ADD",      0, "+", 2, null); },
            SUBTRACT    : function() { return new NodeType.expression(arguments, "SUBTRACT", 0, "-", 2, null); },
            NEGATE      : function() { return new NodeType.expression(arguments, "NEGATE",  -1, "-", 1, 1); },
            MULTIPLY    : function() { return new NodeType.expression(arguments, "MULTIPLY", 0, "*", 2, null); },
            DIVIDE      : function() { return new NodeType.expression(arguments, "DIVIDE",   0, "/", 2, null); },
            PAREN       : function() { return new NodeType.expression(arguments, "PAREN",    0, "",  1, 1); },
            LIKE         : function() { return new NodeType.expression(arguments, "LIKE",   0, "LIKE",  2, 2, "match"); },
            BETWEEN      : TODO,
            AVG            : function() { return new NodeType.aggregate(arguments, "AVG",   -1, null, 1, 1); },
            AVG_ALL        : TODO,
            AVG_DISTINCT   : TODO,
            SUM            : function() { return new NodeType.aggregate(arguments, "SUM",   -1, null, 1, 1); },
            SUM_ALL        : TODO,
            SUM_DISTINCT   : TODO,
            COUNT          : function() { return new NodeType.aggregate(arguments, "COUNT", -1, null, 1, 1); },
            COUNT_ALL      : TODO,
            COUNT_DISTINCT : TODO,
            AS     : USAGE, // We use expression.AS(), table.AS(), and column.AS() instead.
            IN     : TODO,
            UNION     : TODO,
            UNION_ALL : TODO,
            EXCEPT     : TODO,
            EXCEPT_ALL : TODO,
            INTERSECT     : TODO,
            INTERSECT_ALL : TODO,
            CROSS_JOIN       : function(tableDef) { return tableDef; },
            INNER_JOIN       : function(tableDef) { return new NodeType.join("INNER", tableDef); },
            LEFT_OUTER_JOIN  : function(tableDef) { return new NodeType.join("LEFT OUTER", tableDef); },
            RIGHT_OUTER_JOIN : TODO,
            FULL_OUTER_JOIN  : TODO,
            ON               : USAGE, // We use LEFT_OUTER_JOIN(x).ON() syntax instead.
            USING            : USAGE, // We use LEFT_OUTER_JOIN(x).USING() syntax instead.
            GROUP_BY   : function() { return new NodeType.groupBy(arguments); },
            HAVING     : function() { return new NodeType.having(arguments); },
            ORDER_BY   : function() { return new NodeType.orderBy(arguments); },
            LIMIT      : function(offset, total) { return new NodeType.limit(offset, total); },
            LIMIT_ALL  : function(offset) { return queryLang.LIMIT(-1, offset); },
            OFFSET     : USAGE, // We use the shortcut comma-based syntax of "LIMIT count, offset".
            ANY_SELECT : TODO,  // TODO: Consider using syntax of LT.ANY(Invoice.total, SELECT(...))
            ALL_SELECT : TODO,
            EXISTS     : TODO,
            WHERE_SQL  : function(sql) { return new NodeType.whereSql(sql); },
            HAVING_SQL : function(sql) { return new NodeType.havingSql(sql); }
        };

        keywords.SELECT = keywords.SELECT_ALL;

        for (var k in keywords)
            queryLang[k] = keywords[k];
        for (var tableName in tableInfos)
            queryLang[tableName] = new NodeType.tableDef(tableName, tableInfos[tableName]);
        return queryLang;
    }

    /////////////////////////////////////////////////////

    var compileJoinDriver = function(tables) { // The join driver naively visits the cross-product.
        var funcText = [ "var TrimPath_query_tmpJD = function(dataTables, joinFilter, whereFilter, bindings) {",
            "var result = [], filterArgs = [ bindings ];" ];
        for (var i = 0; i < tables.length; i++)
            funcText.push("var T" + i + " = dataTables['" + tables[i][".name"] + "'] || [];");
        for (var i = 0; i < tables.length; i++) {
            funcText.push("for (var t"+i+" = 0; t"+i+" < T"+i+".length; t"+i+"++) {");
            funcText.push("var resultLength"+i+" = result.length;");
            funcText.push("filterArgs["+(i+1)+"] = T"+i+"[t"+i+"];");
        }
        funcText.push("if ((joinFilter == null || joinFilter.apply(null, filterArgs) == true) && ");
        funcText.push("    (whereFilter == null || whereFilter.apply(null, filterArgs) == true))");
        funcText.push(    "result.push(filterArgs.slice(0));");
        for (var i = tables.length - 1; i >= 0; i--) {
            funcText.push("}");
            if (i >= 1 && tables[i].joinType == "LEFT OUTER") {
                funcText.push("if (resultLength"+(i-1)+" == result.length) {");
                for (var j = i; j < tables.length; j++)
                    funcText.push("filterArgs[" + (j+1) + "] = ");
                funcText.push("{}; if (whereFilter == null || whereFilter.apply(null, filterArgs) == true) result.push(filterArgs.slice(0)); }");
            }
        }
        funcText.push("return result; }; TrimPath_query_tmpJD");
        return theEval(funcText.join(""));
    }

    var compileFilter = function(bodyFunc, tables, whereExpressions, flags) { // Used for WHERE and HAVING.
        var funcText = [ "var TrimPath_query_tmpWF = function(_BINDINGS" ];
        for (var i = 0; i < tables.length; i++)
            funcText.push(", " + tables[i][".alias"]);
        funcText.push("){ with(_BINDINGS) {");
        bodyFunc(funcText, tables, whereExpressions, flags);
        funcText.push("return true; }}; TrimPath_query_tmpWF");
        return theEval(funcText.join(""));
    }

    var compileFilterForJoin = function(funcText, tables, whereExpressions, flags) {
        for (var i = 0; i < tables.length; i++) { // Emit JOIN ON/USING clauses.
            if (tables[i].joinType != null) {
                if (tables[i].ON_exprs != null || tables[i].USING_exprs != null) {
                    funcText.push("if (!(");
                    if (tables[i].ON_exprs != null && tables[i].ON_exprs[0].exprs != null) {
                        funcText.push(tables[i].ON_exprs[0].exprs[0].toJs())
                    } else if(tables[i].ON_exprs != null)
                        funcText.push(map(tables[i].ON_exprs, toJs).join(" && "));
                    if (tables[i].USING_exprs != null)
                        funcText.push(map(tables[i].USING_exprs, function(col) {
                            return "(" + tables[i - 1][".alias"] + "." + col + " == " + tables[i][".alias"] + "." + col + ")";
                        }).join(" && "));
                    funcText.push(")) return false;");
                }
            }
        }
    }

    var compileFilterForWhere = function(funcText, tables, whereExpressions, flags) {
        if (whereExpressions != null) {
            funcText.push("if (!(("); // Emit the main WHERE clause test.
            for (var i = 0; i < whereExpressions.length; i++) {
                if (i > 0)
                    funcText.push(") && (");
                funcText.push(toJs(whereExpressions[i], flags));
            }
            funcText.push("))) return false;");
        }
    }
    var compileColumnConvertor = function(tables, columnExpressions) {
        var funcText = [ "var TrimPath_query_tmpCC = function(_BINDINGS, " ];
        var table_aliases = [];
        for (var i = 0; i < tables.length; i++)
            table_aliases.push(tables[i][".alias"]);
        funcText.push(arrayUniq(table_aliases).join(', '));
        funcText.push(", with_table){ with(_BINDINGS) {");
        funcText.push("var _RESULT = {};");
        funcText.push("if(with_table) {");
        compileColumnConvertorHelper(funcText, columnExpressions, true);
        funcText.push("} else {");
        compileColumnConvertorHelper(funcText, columnExpressions, false);
        funcText.push("}");
        funcText.push("return _RESULT; }}; TrimPath_query_tmpCC");
        return theEval(funcText.join(""));
    }

    var test = function(stuff) {
        var i;
    }
    var compileColumnConvertorHelper = function(funcText, columnExpressions, with_table) {
        for (var i = 0; i < columnExpressions.length; i++) {
            var columnExpression = columnExpressions[i];
            if (columnExpression[".name"] == "*") {
                compileColumnConvertorHelper(funcText, columnExpression.tableDef[".allColumns"], with_table);
            } else {
                funcText.push("_RESULT['"); // TODO: Should we add _RESULT[i] as assignee?
                if(with_table == true) {
                    funcText.push(columnExpression.toString());
                } else {
                    funcText.push(columnExpression[".alias"]);
                }
                funcText.push("'] = (");
                funcText.push(toJs(columnExpression));
                funcText.push(");");
            }
        }
    }

    var dateToString = function(date) {
        if(typeof date == 'object')
            return [date.getFullYear(), '-', (date.getMonth()+1), '-', date.getDate()].join('');
        if(date == null)
            return null;
    }

    var compileOrderByComparator = function(orderByExpressions) {
        var funcText = [ "var TrimPath_query_tmpOC = function(A, B) { var a, b; " ];
        for (var i = 0; i < orderByExpressions.length; i++) {
            var orderByExpression = orderByExpressions[i];
            if(orderByExpression.tableDef) {
                funcText.push("a = A['" + orderByExpression[".alias"] + "'] || A['" +
                    orderByExpression.tableDef['.alias'] + '.' + orderByExpression[".alias"] + "'] || '';");
                funcText.push("b = B['" + orderByExpression[".alias"] + "'] || B['" +
                    orderByExpression.tableDef['.alias'] + '.' + orderByExpression[".alias"] + "'] || '';");
            } else {
                funcText.push("a = A['" + orderByExpression[".alias"] + "'] || '';");
                funcText.push("b = B['" + orderByExpression[".alias"] + "'] || '';");
            }
            var sign = (orderByExpression.order == "DESC" ? -1 : 1);
            funcText.push("if (a.valueOf() < b.valueOf()) return " + (sign * -1) + ";");
            funcText.push("if (a.valueOf() > b.valueOf()) return " + (sign * 1) + ";");
        }
        funcText.push("return 0; }; TrimPath_query_tmpOC");
        return theEval(funcText.join(""));
    }

    var compileGroupByCalcValues = function(tables, groupByExpressions) {
        var funcText = [ "var TrimPath_query_tmpGC = function(_BINDINGS" ];
        for (var i = 0; i < tables.length; i++)
            funcText.push(", " + tables[i][".alias"]);
        funcText.push("){ var _RESULT = [];");
        for (var i = 0; i < groupByExpressions.length; i++) {
            funcText.push("_RESULT.push(");
            funcText.push(toJs(groupByExpressions[i]));
            funcText.push(");");
        }
        funcText.push("return _RESULT; }; TrimPath_query_tmpGC");
        return theEval(funcText.join(""));
    }

    /////////////////////////////////////////////////////

    var groupByComparator = function(a, b) {
        return arrayCompare(a.groupByValues, b.groupByValues);
    }

    var arrayCompare = function(x, y) {
        if (x == null || y == null) return -1; // Required behavior on null for GROUP_BY to work.
        for (var i = 0; i < x.length && i < y.length; i++) {
            if (x[i] < y[i]) return -1;
            if (x[i] > y[i]) return 1;
        }
        return 0;
    }

    var toSqlWithAlias = function(obj, flags) {
        var res = toSql(obj, flags);
        if (obj[".alias"] != null &&
            obj[".alias"] != obj[".name"])
            return res + " AS " + obj[".alias"];
        return res;
    }
    var toSql = function(obj, flags) { return toX(obj, "toSql", flags); }
    var toJs  = function(obj, flags) { return toX(obj, "toJs",  flags); }
    var toX   = function(obj, funcName, flags) {
        if (typeof(obj) == "object" && obj[funcName] != null)
            return obj[funcName].call(obj, flags);
        return theString(obj);
    }

    var zeroDefault = function(x) { return (x != null ? x : 0); }

    var map = function(arr, func, arg2) { // Lisp-style map function on an Array.
        for (var result = [], i = 0; i < arr.length; i++)
            result.push(func(arr[i], arg2));
        return result;
    }

    var cleanArray = function(src, quotes) {
        for (var result = [], i = 0; i < src.length; i++)
            result.push(cleanString(src[i], quotes));
        return result;
    }

    var cleanString = TrimPath.TEST.cleanString = function(src, quotes) { // Example: "hello" becomes "'hello'"
        if (src instanceof theString || typeof(src) == "string") {
            src = theString(src).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            if (quotes != false) // Handles null as true.
                src = "'" + src + "'";
        }
        return src;
    }

    var findClause = function(str, regexp) {
        var clauseEnd = str.search(regexp);
        if (clauseEnd < 0)
            clauseEnd = str.length;
        return str.substring(0, clauseEnd);
    }

    QueryLang.prototype.parseSQL = function(sqlQueryIn, paramsArr) { // From sql to tql.
        var sqlQuery = sqlQueryIn.replace(/\n/g, ' ').replace(/\r/g, '');

        if (paramsArr != null) { // Convert " ?" to args from optional paramsArr.
            if (paramsArr instanceof theArray == false)
                paramsArr = [ paramsArr ];

            var sqlParts = sqlQuery.split(' ?');
            for (var i = 0; i < sqlParts.length - 1; i++)
                sqlParts[i] = sqlParts[i] + ' ' + cleanString(paramsArr[i], true);
            sqlQuery = sqlParts.join('');
        }

        sqlQuery = sqlQuery.replace(/ AS ([_a-zA-z0-9]+)/g, ".AS('$1')");

        var err = function(errMsg) {
            throw ("[ERROR: " + errMsg + " in query: " + sqlQueryIn + "]");
        };

        var query_type = sqlQuery.split(/\s+/)[0];
        if (query_type == 'DELETE')
            query_type = 'DESTROY';

        if (!arrayInclude(['SELECT', 'DESTROY', 'UPDATE', 'INSERT'], query_type))
            err("not a valid query type");

        var strip_whitespace = function(str) {
            return str.replace(/\s+/g, '');
        }

        if (query_type == 'SELECT' || query_type == 'DESTROY') {

            var fromSplit = sqlQuery.substring(7).split(" FROM ");
            if (fromSplit.length != 2)
                err("missing a FROM clause");

            //SELECT Invoice.*, Customer.* FROM Invoice, Customer
            //SELECT * FROM Invoice, Customer
            //DELETE things, relationships FROM relationships LEFT OUTER JOIN things ON things.relationship_id = relationships.id WHERE relationships.id = 2
            //SELECT * FROM relationships LEFT OUTER JOIN users ON relationships.created_by = users.id AND relationships.updated_by = users.id LEFT OUTER JOIN things ON things.relatedrelationship_id = relationships.id  ORDER BY relationships.updated_at DESC LIMIT 0, 20
            var columnsClause = fromSplit[0].replace(/\.\*/g, ".ALL");
            var remaining     = fromSplit[1];
            var fromClause    = findClause(remaining, /\sWHERE\s|\sGROUP BY\s|\sHAVING\s|\sORDER BY\s|\sLIMIT/);
            var fromTableClause = findClause(fromClause, /\sLEFT OUTER JOIN\s/);
            var fromTables = strip_whitespace(fromTableClause).split(',');
            remaining = remaining.substring(fromClause.length);

            var fromClauseSplit = fromClause.split(" LEFT OUTER JOIN ");
            var fromClauseParts = [fromClauseSplit[0]];
            var leftJoinComponents;
            for (var i = 1; i < fromClauseSplit.length; i++) {
                leftJoinComponents = /(\w+)\sON\s(.+)/.exec(fromClauseSplit[i]);
                fromTables.push(leftJoinComponents[1]);
                fromClauseParts.push( '('+leftJoinComponents[1]+')'+'.ON(WHERE_SQL("'+leftJoinComponents[2]+'"))' );
            }
            fromClause = fromClauseParts.join(", LEFT_OUTER_JOIN");

            if(strip_whitespace(columnsClause) == '*') {
                var new_columns = [];
                for(var i=0; i<fromTables.length; i++) {
                    new_columns.push(fromTables[i]+'.ALL')
                }
                columnsClause = columnsClause.replace(/\*/, new_columns.join(', '))
            }
            var whereClause   = findClause(remaining, /\sGROUP BY\s|\sHAVING\s|\sORDER BY\s|\sLIMIT/);
            remaining = remaining.substring(whereClause.length);
            var groupByClause = findClause(remaining, /\sHAVING\s|\sORDER BY\s|\sLIMIT /);
            remaining = remaining.substring(groupByClause.length);
            var havingClause  = findClause(remaining, /\sORDER BY\s|\sLIMIT /);
            remaining = remaining.substring(havingClause.length);
            var orderByClause = findClause(remaining, /\sLIMIT /).replace(/\sASC/g, ".ASC").replace(/\sDESC/g, ".DESC");
            remaining = remaining.substring(orderByClause.length);
            var limitClause   = remaining;

            var tql = [ 'SELECT(FROM(', fromClause, '), ', columnsClause];
            if (whereClause.length > 0)
                tql.push(', WHERE_SQL("' + whereClause.substring(7) + '")');
            if (groupByClause.length > 0)
                tql.push(', GROUP_BY(' + groupByClause.substring(10) + ')');
            if (havingClause.length > 0)
                tql.push(', HAVING_SQL("' + havingClause.substring(8) + '")');
            if (orderByClause.length > 0)
                tql.push(', ORDER_BY(' + orderByClause.substring(10) + ')');
            if (limitClause.length > 0)
                tql.push(', LIMIT(' + limitClause.substring(7) + ')');
            tql.push(')');
        }
        else if (query_type == "INSERT") {
            // accepts sql of the format: INSERT INTO things (field1, field2) VALUES ('value1', 'value2')
            var intoSplit = sqlQuery.substring(6).split(" INTO ");
            if (intoSplit.length != 2)
                err("missing an INTO clause");
            var insertion_regex = /^\s*(\w+)\s*\((.+)\)\s+VALUES\s+\((.+)\)/
            var parsed_sql = intoSplit[1].match(insertion_regex);
            var table_name = parsed_sql[1];
            var fields = strip_whitespace(parsed_sql[2]).split(',');
            var values = parsed_sql[3].split(',');
            if (fields.length != values.length)
                err("values and fields must have same number of elements");

            tql = ['INSERT(', table_name, ',', simpleJson(fields, values), ')'];
        }
        else if (query_type == "UPDATE") {
            // UPDATE things SET relatedrelationship_id=2, name="poop" WHERE things.relatedrelationship_id=1
            //var tql = ['UPDATE(FROM(things ), {"relatedrelationship_id": "2"}, WHERE_SQL("things.relatedrelationship_id = 1"))'];
            var setSplit = sqlQuery.substring(7).split(" SET ");
            if (setSplit.length != 2)
                err("missing a SET clause");
            var fromClause = setSplit[0];
            var remaining  = setSplit[1];
            var assignmentClause   = findClause(remaining, /\sWHERE\s/);
            remaining = remaining.substring(assignmentClause.length);
            var whereClause = remaining;
            var assignmentArray = assignmentClause.split(',');
            var fields = [];
            var values = [];
            for (var i=0; i<assignmentArray.length; i++) {
                var components = assignmentArray[i].split('=');
                fields.push(strip(components[0]));
                values.push(strip(components[1]));
            }
            var update_regex = /^UPDATE\s+(\w+)\s+SET\s+(\w+\s*=\s*\w+)/
            var parsed_sql = sqlQuery.match(update_regex);

            var tql = ['UPDATE(FROM(', fromClause, '), ', simpleJson(fields, values)];
            tql.push(', WHERE_SQL("' + whereClause.substring(7) + '")');
            tql.push(')');
        }
        if(query_type == 'DESTROY') {
            tql.unshift('DESTROY(');
            tql.push(')');
        }
        with (this) {
            return eval(tql.join(''));
        }
    }
}) ();

