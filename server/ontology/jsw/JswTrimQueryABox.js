/**
 * Created by Spadon on 17/10/2014.
 */
var Logics = require('./Logics'),
    IncrementalReasoner = require('./IncrementalReasoning'),
    Utils = require('./Utils'),
    _ = require('lodash');

TrimPath = require('./TrimPathQuery'),
    rdf = require('./JswRDF'),
    owl = require('./JswOWL');

/** Allows to work with SQL representation of queries against RDF data. */
var TrimQueryABox = function () {
    /** The object storing ABox data. */
    this.database = {
        ClassAssertion: [],
        ObjectPropertyAssertion: [],
        DataPropertyAssertion: []
    };

    /** The object which can be used to send queries against ABoxes. */
    this.queryLang = this.createQueryLang();
};

/** Prototype for all jsw.TrimQueryABox objects. */
TrimQueryABox.prototype = {
    processSql: function(queries, recreateQueryLang) {
        var queryLang, responses = [];
        recreateQueryLang ? queryLang = this.queryLang : this.createQueryLang();
        for (var key in queries) {
            var query = queries[key];
            responses.push(queryLang.parseSQL(query).filter(this.database));
        }
        return responses;
    },
    /**
     * Answers the given RDF query.
     *
     * @param query RDF query to answer.
     * @return Data set containing the results matching the query.
     */
    answerQuery: function (query, ontology, rules) {
        var sql = this.createSql(query, ontology, rules), sqlQueries = sql.split(';').slice(0,-1);

        try {
            return this.processSql(sqlQueries, false);
        } catch (ex) {
            /* Recreate the query language object, since the previous object can not be used now.*/
            return this.processSql(sqlQueries, true);
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
        var data = {
            individual: individualIri,
            className: classIri
        };

        if (JSON.stringify(this.database.ClassAssertion).indexOf(JSON.stringify(data)) === -1) {
            this.database.ClassAssertion.push(data);
        }
    },

    /**
     * Adds an object property assertion to the database.
     *
     * @param objectPropertyIri IRI of the object property in the assertion.
     * @param leftIndIri IRI of the left individual in the assertion.
     * @param rightIndIri IRI of the right individual in the assertion.
     */
    addObjectPropertyAssertion: function (objectPropertyIri, leftIndIri, rightIndIri) {
        var data = {
            objectProperty: objectPropertyIri,
            leftIndividual: leftIndIri,
            rightIndividual: rightIndIri
        };

        if (JSON.stringify(this.database.ObjectPropertyAssertion).indexOf(JSON.stringify(data)) === -1) {
            this.database.ObjectPropertyAssertion.push(data);
        }
    },

    /**
     * Adds data property assertion to the database.
     * @author Mehdi Terdjimi
     * @param dataPropertyIri IRI of the data property in the assertion.
     * @param leftIndIri IRI of the left individual in the assertion.
     * @param rightValue value of the data.
     */
    addDataPropertyAssertion: function (dataPropertyIri, leftIndIri, rightValue) {
        var data = {
            dataProperty: dataPropertyIri,
            leftIndividual: leftIndIri,
            rightValue: rightValue
        };

        if (JSON.stringify(this.database.DataPropertyAssertion).indexOf(JSON.stringify(data)) === -1) {
            this.database.DataPropertyAssertion.push(data);
        }
    },

    /**
     * Creates an object which can be used for sending queries against the database.
     *
     * @return Object which can be used for sending queries against the database.
     */
    createQueryLang: function () {
        return TrimPath.makeQueryLang({
            ClassAssertion: { individual: { type: 'String' },
                className: { type: 'String' },
                explicit: { type: 'Boolean' }},
            ObjectPropertyAssertion: { objectProperty: { type: 'String' },
                leftIndividual: { type: 'String' },
                rightIndividual: { type: 'String' },
                explicit: { type: 'Boolean' }},
            DataPropertyAssertion: { dataProperty: { type: 'String' },
                leftIndividual: { type: 'String' },
                rightValue: { type: 'String' },
                explicit: { type: 'Boolean' }}
        });
    },

    /** Appends a condition to the where clause based on the given expression.
     *

     * @param expr Expression to use for constructing a condition.
     * @param table Name of the table corresponding to the expression.
     * @param field Name of the field corresponding to the expression.
     */
    writeExprCondition: function(expr, table, field, where, varFields) {
        var type = expr.type,
            value = expr.value,
            varField;

        if (type === rdf.ExpressionTypes.IRI_REF || type === rdf.ExpressionTypes.LITERAL) {
            if (type === rdf.ExpressionTypes.LITERAL) value = value.replace(/"/g, '\\"');
            where += table + '.' + field + "=='" + value + "' AND ";

        } else if (type === rdf.ExpressionTypes.VAR) {
            varField = varFields[value];

            if (varField) {
                where += table + '.' + field + '==' + varField + ' AND ';
            } else {
                varFields[value] = table + '.' + field;
            }
        } else {
            throw 'Unknown type of expression found in the RDF query: ' + type + '!';
        }

        return {
            where: where,
            varFields: varFields
        };
    },

    /**
     * Returns an SQL representation of the given RDF query.
     *
     * @param query jsw.rdf.Query to return the SQL representation for.
     * @return string representation of the given RDF query.
     */
    createSql: function (query, ontology, R) {
        var from, where, limit, object, objectField, objectType, orderBy, predicate, predicateType, predicateValue, predicateField,
            select, table, subjectField, table, triple, triples, tripleCount, tripleIndex, variable, vars, varCount,
            varField, varFields, varIndex, consequences;

        if (query.statementType == 'DELETE') {

            query.triples = this.consequencesToTriples(
                                this.naiveReasoning(new Array(), query.triples, ontology, R));
            query.triples = this.consequencesToTriples();
            this.purgeABox();
            return this.createInsertStatement(query.triples).join('');

        } else if (query.statementType == 'INSERT') {
            consequences = this.naiveReasoning(query.triples, new Array(), ontology, R);
            query.triples = this.consequencesToTriples(consequences.fe, true).concat(
                            this.consequencesToTriples(consequences.fi, false));
            this.purgeABox();
            return this.createInsertStatement(query.triples).join('');

        } else if (query.statementType == 'SELECT') {
            from = '';
            where = '';
            varFields = {};
        } else {
                throw 'Statement type unrecognized.';
        }

        triples = query.triples;
        tripleCount = triples.length;

        for (tripleIndex = 0; tripleIndex < tripleCount; tripleIndex += 1) {
            triple = triples[tripleIndex];

            predicate = triple.predicate;
            object = triple.object;
            predicateType = predicate.type;
            predicateValue = predicate.value;
            objectType = object.type;
            subjectField = 'leftIndividual';
            objectField = 'rightIndividual';
            table = 't' + tripleIndex;


            if (predicateValue === rdf.IRIs.TYPE) {
                from += 'ClassAssertion AS ' + table + ', ';
                subjectField = 'individual';
                objectField = 'className';
// todo traiter le cas ou dprop n'est pas reference
            } else if (predicateValue in ontology.entities[owl.ExpressionTypes.ET_DPROP]) {
                objectField = 'rightValue';
                from += 'DataPropertyAssertion AS ' + table + ', ';
                varField = varFields[predicateValue];
                predicateField = 'dataProperty';
                if (varField) {
                    where += table + '.dataProperty==' + varField + ' AND ';
                } else {
                    varFields[predicateValue] = table + '.dataProperty';
                }

            // for now, we consider this...
            } else if (predicateType === rdf.ExpressionTypes.IRI_REF) {
                from += 'ObjectPropertyAssertion AS ' + table + ', ';
                varField = varFields[predicateValue];
                predicateField = 'objectProperty';
                if (varField) {
                    where += table + '.objectProperty==' + varField + ' AND ';
                } else {
                    varFields[predicateValue] = table + '.objectProperty';
                }
            } else {
                throw 'Unknown type of a predicate expression: ' + predicateType + '!';
            }

            var subjectCond = this.writeExprCondition(triple.subject, table, subjectField, where, varFields);
            where = subjectCond.where;
            varFields = subjectCond.varFields;

            if(predicateField) {
                var predicateCond = this.writeExprCondition(triple.predicate, table, predicateField, where, varFields);
                where = predicateCond.where;
                varFields = predicateCond.varFields;
            }

            var objectCond = this.writeExprCondition(triple.object, table, objectField, where, varFields);
            where = objectCond.where;
            varFields = objectCond.varFields;
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

        return select + from + where + orderBy + limit + ';';
    },

    /**
     * Convert JSW assertion facts into formal Logics.js facts
     * @author Mehdi Terdjimi
     */
    convertAssertions: function(explicit) {
        var assertion,
            triples = [],
            rdfType = rdf.IRIs.TYPE;

        for(var key in this.database.ClassAssertion) {
            assertion = this.database.ClassAssertion[key];
            triples.push({
                subject: { value: assertion.individual },
                predicate: { value: rdfType },
                object: { value: assertion.className }
            });
        }

        for(var key in this.database.ObjectPropertyAssertion) {
            assertion = this.database.ObjectPropertyAssertion[key];
            triples.push({
                subject: { value: assertion.leftIndividual },
                predicate: { value: assertion.objectProperty },
                object: { value: assertion.rightIndividual }
            });
        }

        for(var key in this.database.DataPropertyAssertion) {
            assertion = this.database.DataPropertyAssertion[key];
            triples.push({
                subject: { value: assertion.leftIndividual },
                predicate: { value: assertion.dataProperty },
                object: { value: assertion.rightValue }
            });
        }

        return this.convertTriples(triples);
    },

    /**
     * Convert JSW triples into formal Logics.js facts
     * @author Mehdi Terdjimi
     */
    convertTriples: function(triples) {
        var sub, pred, obj,
            newFacts = [];
        for(var key in triples) {
            var triple = triples[key];
            sub = triple.subject;
            pred = triple.predicate;
            obj = triple.object;
            newFacts.push(new Logics.fact(pred.value, sub.value, obj.value));
        }

        return newFacts;
    },

    /**
     * A naïve reasoner that recalculates the entire knowledge base
     * wtr. a set of triples to insert and a set of triples to delete.
     * @param triplesIns
     * @param triplesDel
     * @param rules
     * @returns {Array.<T>}
     */
    naiveReasoning: function(triplesIns, triplesDel, ontology, rules) {
        // Explicit facts
        var Fe = Utils.uniqConcat(
                    Utils.uniqConcat(this.convertAssertions(), ontology.convertAxioms()),
                    Utils.uniqConcat(this.convertTriples(triplesIns), ontology.convertEntities()));

        if(triplesDel.length) Fe = Utils.diff(F, this.convertTriples(triplesDel));

        var consequences = [];
        for (var key in rules) {
            consequences = Utils.uniqConcat(consequences, rules[key].consequences(consequences.concat(Fe)));
        }

        return {
            fi: consequences,
            fe: Fe
        };
    },

    /** Used to suit JSW requirements
     *
     * @param consequences
     * @returns {Array}
     */
    consequencesToTriples: function(consequences, explicit) {
        var triples = [];
        for(var key in consequences) {
            var fact = consequences[key];
            if(fact.rightIndividual.match(/"[^"]*"/g)) {
                triples.push({
                    subject: {
                        value: fact.leftIndividual,
                        type: rdf.ExpressionTypes.IRI_REF
                    },
                    predicate : {
                        value: fact.name,
                        type: rdf.ExpressionTypes.IRI_REF
                    },
                    object: {
                        value: fact.rightIndividual,
                        type: rdf.ExpressionTypes.LITERAL
                    },
                    explicit: explicit
                });
            } else {
                triples.push({
                    subject: {
                        value: fact.leftIndividual,
                        type: rdf.ExpressionTypes.IRI_REF
                    },
                    predicate : {
                        value: fact.name,
                        type: rdf.ExpressionTypes.IRI_REF
                    },
                    object: {
                        value: fact.rightIndividual,
                        type: rdf.ExpressionTypes.IRI_REF
                    },
                    explicit: explicit
                });
            }
        }
        return triples;
    },

    createInsertStatement: function(triples) {
        var tuples, statement,
            insert = 'INSERT',
            into = ' INTO ',
            values = ' VALUES',
            statements = [],
            table;

        for (var tripleKey in triples) {
            var triple = triples[tripleKey];
            // If it is an assertion...
            if (triple.predicate.value == rdf.IRIs.TYPE) {
                table = "ClassAssertion ('individual', 'className', 'explicit')";
                tuples = " ('" + triple.subject.value + "', '" + triple.object.value + "', '" + triple.explicit + "')";
            } else if (triple.predicate.type == rdf.ExpressionTypes.IRI_REF && triple.object.type == rdf.ExpressionTypes.IRI_REF) {
                table = "ObjectPropertyAssertion ('objectProperty', 'leftIndividual', 'rightIndividual', 'explicit')";
                tuples = " ('" + triple.predicate.value + "', '" + triple.subject.value + "', '" + triple.object.value + "', '" + triple.explicit + "')";
            } else if (triple.predicate.type == rdf.ExpressionTypes.IRI_REF && triple.object.type == rdf.ExpressionTypes.LITERAL) {
                table = "DataPropertyAssertion ('dataProperty', 'leftIndividual', 'rightValue', 'explicit')";
                tuples = " ('" + triple.predicate.value + "', '" + triple.subject.value + "', '" + triple.object.value + "', '" + triple.explicit + "')";
            } else {
                throw 'Unrecognized assertion type.';
            }

            statement = insert + into + table + values + tuples + ";";
            statements.push(statement);
        }
        return statements;
    },

    purgeABox: function() {
        this.database.ClassAssertion = [];
        this.database.DataPropertyAssertion = [];
        this.database.ObjectPropertyAssertion = [];
    }

};


module.exports = {
    trimQueryABox: TrimQueryABox
};
