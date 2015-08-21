/**
 * Created by Spadon on 17/10/2014.
 */
TrimPath = require('./TrimPathQuery'),
    rdf = require('./JswRDF');

/** Allows to work with SQL representation of queries against RDF data. */
var TrimQueryABox = function () {
    /** The object storing ABox data. */
    this.database = {
        ClassAssertion: [],
        ObjectPropertyAssertion: [],
        ClassSubsumer: [],
        ObjectPropertySubsumer: []
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
            return this.createQueryLang().parseSQL(sql).filter(this.database);
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
            ClassAssertion: { individual: { type: 'String' },
                className: { type: 'String' },
                rightclassName: { type: 'String' },
                leftclassName: { type: 'String' }},
            ObjectPropertyAssertion: { objectProperty: { type: 'String' },
                leftIndividual: { type: 'String' },
                rightIndividual: { type: 'String' }}
        });
    },

    /**
     * Returns an SQL representation of the given RDF query.
     *
     * @param query jsw.rdf.Query to return the SQL representation for.
     * @return string representation of the given RDF query.
     */
    createSql: function (query) {
        var from, limit, objectField, orderBy, predicate, predicateType, predicateValue, rdfTypeIri, subClassOfIri,
            select, subjectField, table, triple, triples, tripleCount, tripleIndex, variable, vars, varCount, varField, varFields, varIndex, where;

        from = '';
        where = '';
        rdfTypeIri = rdf.IRIs.TYPE;
        subClassOfIri = rdf.IRIs.SUBCLASS;

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

                } else if (predicateValue === subClassOfIri) {
                    from += 'ClassSubsumer AS ' + table + ', ';
                    subjectField = 'class';
                    objectField = 'classSubsumer';

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


module.exports = {
    trimQueryABox: TrimQueryABox
};
