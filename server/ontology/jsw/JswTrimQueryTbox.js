/**
 * Created by Spadon on 21/08/2015.
 * @author Mehdi Terdjimi
 */
TrimPath = require('./TrimPathQuery'),
    rdf = require('./JswRDF');

/** Allows to work with SQL representation of queries against RDF data. */
var TrimQueryTBox = function () {
    /** The object storing TBox data. */
    this.database = {
        Class: [],
        ClassSubsumer: [],
        ObjectProperty: [],
        ObjectPropertySubsumer: [],
        DataProperty: []
    };
};

TrimQueryTBox.prototype = {
    /**
     * @author Mehdi Terdjimi
     * Adds a class subsumer to the database.
     * (classIri subClassOf classSubsumerIri)
     */
    addClassSubsumer: function (classIri, classSubsumerIri) {
        this.database.ClassSubsumer.push({
            class: classIri,
            classSubsumer: classSubsumerIri
        });
    },

    /**
     * @author Mehdi Terdjimi
     * Adds a object property subsumer to the database.
     * (objectPropertyIri subPropertyOf objectPropertySubsumerIri)
     */
    addObjectPropertySubsumer: function (objectPropertyIri, objectPropertySubsumerIri) {
        this.database.ObjectPropertySubsumer.push({
            objectProperty: objectPropertyIri,
            objectPropertySubsumer: objectPropertySubsumerIri
        });
    },

    /**
     * Creates an object which can be used for sending queries against the tBox database.
     * @author Mehdi Terdjimi
     * @return Object which can be used for sending queries against the tBox database.
     */
    createTBoxQueryLang: function () {
        return TrimPath.makeQueryLang({
            Class: {
                className: { type: 'String' }
            },
            ClassSubsumer: {
                class: { type: 'String' },
                classSubsumer: { type: 'String' }
            },
            ObjectProperty: {
                objectProperty: { type: 'String' }
            },
            ObjectPropertySubsumer: {
                objectProperty: { type: 'String' },
                objectPropertySubsumer: { type: 'String' }
            },
            DataProperty: {
                dataProperty: { type: 'String' }
            }
        });
    }
};

module.exports = {
    trimQueryTBox: TrimQueryTBox
};