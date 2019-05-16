const { PER_PAGE } = require('../../utils/constants')
const createFieldDefinitions = require('../createFieldDefinitions')
const { createFilterTypes, createFilterQuery } = require('../createFilterTypes')
const { createPagedNodeEdges, createSortOptions } = require('./utils')

module.exports = function createConnection ({
  schemaComposer,
  contentType,
  fieldDefs,
  typeName
}) {
  const edgeType = schemaComposer.createObjectTC({
    name: `${typeName}Edge`,
    fields: {
      node: typeName,
      next: typeName,
      previous: typeName
    }
  })

  const connectionType = schemaComposer.createObjectTC({
    name: `${typeName}Connection`,
    fields: {
      totalCount: 'Int!',
      pageInfo: 'PageInfoType!',
      edges: () => [edgeType]
    }
  })

  const nodeFieldDefs = createFieldDefinitions([{ id: '' }])
  const filterType = schemaComposer.createInputTC({
    name: `${typeName}Filters`,
    fields: createFilterTypes(schemaComposer, { ...fieldDefs, ...nodeFieldDefs }, `${typeName}Filter`)
  })

  const filterFields = filterType.getType().getFields()

  const { defaultSortBy, defaultSortOrder } = contentType.options

  const connectionArgs = {
    sortBy: { type: 'String', defaultValue: defaultSortBy },
    order: { type: 'SortOrderEnum', defaultValue: defaultSortOrder },
    perPage: { type: 'Int', description: `Defaults to ${PER_PAGE} when page is provided.` },
    skip: { type: 'Int', defaultValue: 0 },
    limit: { type: 'Int' },
    page: { type: 'Int' },
    sort: { type: '[SortArgument]' },
    filter: {
      type: filterType,
      description: `Filter for ${typeName} nodes.`
    },

    // TODO: remove before 1.0
    regex: { type: 'String', deprecationReason: 'Use filter instead.' }
  }

  return {
    type: () => connectionType,
    args: connectionArgs,
    description: `Connection to all ${typeName} nodes`,
    async resolve (_, { regex, filter, ...args }, { store }) {
      const { collection } = store.getContentType(typeName)
      const sort = createSortOptions(args)
      const query = {}

      for (const [fieldName] of sort) {
        collection.ensureIndex(fieldName)
      }

      if (regex) {
        // TODO: remove before 1.0
        query.path = { $regex: new RegExp(regex) }
      }

      if (filter) {
        Object.assign(query, createFilterQuery(filter, filterFields))
      }

      const chain = collection.chain().find(query)

      return createPagedNodeEdges(chain, args, sort)
    }
  }
}
