---
applyTo: "convex/schema.ts"
---

# Best Practices & Mental Models for Convex Data Modeling and Schema Design

Convex’s data modeling and schema design do require a different mindset compared to traditional relational databases. Here are best practices and mental models to help guide you:

1. Favor Granular, Purpose-Built Documents  
   Avoid “sprawling” documents that aggregate unrelated or frequently-updated data (like session, presence, or cursor data) into a single document. Instead, split data into separate documents/tables for each independent feature, tab, or user. This minimizes unnecessary query invalidations and reduces contention in mutations, especially for high-frequency updates like cursor tracking or heartbeats. Sources: Avoid sprawling session documents.
2. Isolate Frequently Updated Fields  
   If a field (e.g., lastSeen, cursorPosition) is updated often, store it in a separate document or table rather than on a widely-referenced parent document. This prevents unrelated queries from being invalidated by frequent, irrelevant updates. Sources: Queries that scale.
3. Use References, Not Deep Nesting  
   Prefer using separate tables/documents with references (IDs) to model relationships, rather than deeply nested objects or arrays. This approach is more maintainable and performant as your app grows. Sources: Document IDs, Other Recommendations.
4. Design for Reactivity  
   Remember that Convex queries are reactive: any change to a document read by a query will cause that query to rerun. Structure your data so that only relevant queries are invalidated by updates, and avoid patterns (like updating a parent’s updatedAt on every child change) that cause excessive reactivity. Sources: Queries that scale.
5. Start Schemaless, Add Rigor Later  
   You can begin prototyping without a schema for speed, but as your app matures, add schemas for type safety and data consistency. Convex supports gradual adoption of schemas, similar to how TypeScript allows incremental typing. Sources: Schema Philosophy, How Convex Works.
6. Use Indexes for Efficient Queries  
   Define indexes on fields you’ll frequently query or filter by, especially for large tables. This ensures queries remain fast and scalable. Sources: Other Recommendations.
7. Think in Terms of Documents, Not Rows  
   Convex is a document database at heart, not a strict relational system. Embrace flexible, JSON-like documents and use unions or optional fields for evolving data models, rather than rigid, column-based schemas. Sources: Convex: The Database that Made Me Switch Careers.

Summary: Model your data in Convex with granularity, reactivity, and separation of concerns in mind. Avoid monolithic documents for unrelated or frequently-changing data, use references for relationships, and leverage Convex’s schema and indexing features as your app grows. This mindset shift will help you build scalable, maintainable, and highly responsive applications.
