# Item Module

Core item management module with clean architecture.

## Structure

```
item/
├── index.ts                    (module export)
├── item.controller.ts          (HTTP request handlers)
├── item.service.ts             (business logic - singleton)
├── item.repository.ts          (data access layer)
└── item.router.ts              (route definitions)
```

## Usage

### Import the module (recommended)

```typescript
import { itemModule } from "./app/item";
import { itemFinancialsModule } from "./app/item-financials";

// Use in your Express app (both modules are independent)
app.use("/api", itemModule(prisma));
app.use("/api", itemFinancialsModule(prisma));
```

### Or combine them manually

```typescript
import { itemModule } from "./app/item";
import { itemFinancialsModule } from "./app/item-financials";

// Both modules work on /api/item path
const itemRouter = itemModule(prisma);
const financialsRouter = itemFinancialsModule(prisma);

app.use("/api", itemRouter);
app.use("/api", financialsRouter);
```

### Import individual components

```typescript
// Import service (functional)
import { createItemService } from "./app/item/item.service";
const itemService = createItemService(prisma);

// Import direct functions (advanced)
import { createItem, getItemById, updateItem } from "./app/item/item.service";

// Import repository
import { itemRepository } from "./app/item/item.repository";
const repo = itemRepository(prisma);

// Import controller
import { controller } from "./app/item/item.controller";
const itemController = controller(prisma);

// Import router
import { router } from "./app/item/item.router";
```

## Functional Singleton Pattern

The service uses a functional singleton pattern for efficient resource management:

```typescript
// Create or get singleton instance
const service1 = createItemService(prisma);
const service2 = createItemService(prisma);
// service1 === service2 ✓ (same instance returned)

// Service instance provides bound methods
await service1.createItem(data);
await service1.getItemById(id);
await service1.updateItem(id, data);
```

### Direct Function Usage (Advanced)

```typescript
import { createItem, getItemById, updateItem } from "./app/item/item.service";

// Use functions directly (pass prisma each time)
const result = await createItem(prisma, itemData);
const item = await getItemById(prisma, itemId);
const updated = await updateItem(prisma, itemId, updateData);
```

## Features

- ✅ **Functional Programming**: Pure functions with singleton pattern
- ✅ **Clean module pattern**: No barrel export anti-pattern
- ✅ **Independent module**: Fully decoupled from item-financials
- ✅ **Consistent patterns**: Matches item-financials functional approach
- ✅ **TypeScript support**: Full type safety
- ✅ **Separation of concerns**: Controller → Service → Repository
- ✅ **Redis caching**: Automatic caching and invalidation
- ✅ **Activity & audit logging**: Complete audit trail
- ✅ **Document upload support**: Cloudinary integration
- ✅ **Flexible API**: Use service instance or direct functions
