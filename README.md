# Bandai PATS API

Backend shell for Bandai Production and Assembly Tracking System.

This repository was cloned from the source API and rebranded as a separate Bandai PATS project. The current codebase still carries inherited project, estimation, and employee-sync modules, but it is now the local backend foundation for the manufacturing initiative.

## 🚀 Overview

The Bandai PATS API provides the local backend foundation for the production and assembly tracking program. Built with TypeScript, Express, Prisma (MongoDB), and comprehensive validation, it keeps the inherited modules runnable while the manufacturing API surface is introduced.

## Local Setup

1. Install dependencies:

```bash
pnpm install
```

2. Start the API:

```bash
pnpm dev
```

3. Open the local API routes in your browser or API client.

## ✨ Key Features

### Core Modules
- **Legacy Project Modules** - Complete project lifecycle management with status tracking
- **Estimation System** - Detailed cost estimation with CAPEX/OPEX/MISC breakdown
- **Item Management** - Flexible item tracking with custom fields and hierarchies
- **ItemType System** - Categorization system for items (CAPEX, OPEX, MISC, Task, Bug, etc.)
- **Category Management** - Organize items and costs by categories
- **Vendor Management** - Track vendors, contacts, and orders
- **Order Processing** - Purchase order management with delivery tracking
- **Payslip Management** - Employee payment tracking and reporting
- **Field System** - Dynamic custom fields (common & custom) with multiple types
- **Template System** - Reusable templates for estimations and projects
- **Sequential System** - Auto-incrementing number generators for documents

### Advanced Features
- **Dynamic Fields** - Support for 11+ field types (text, number, date, select, user, calculated, etc.)
- **Financial Breakdown** - Automatic CAPEX/OPEX/MISC calculations via ItemType relations
- **Category Subtotals** - Automatic calculation of costs by category
- **Item Hierarchy** - Parent-child relationships for complex structures
- **Document Management** - Upload and attach documents to items
- **Audit Logging** - Complete audit trail for all operations
- **Activity Tracking** - User activity monitoring and logging
- **Caching Layer** - Redis caching for improved performance
- **Real-time Updates** - Socket.IO integration for live updates

## 🏗️ Project Architecture

```
bnpi-pats-api/
├── app/                        # Application modules (controllers, routes, repositories)
│   ├── category/              # Category management
│   ├── estimation/            # Estimation system
│   ├── field/                 # Custom fields
│   ├── item/                  # Item management
│   ├── itemType/              # Item type categorization (NEW)
│   ├── order/                 # Order processing
│   ├── payslip/               # Payslip management
│   ├── project/               # Project management
│   ├── template/              # Template system
│   ├── vendor/                # Vendor management
│   └── sequential/           # Auto-increment system
├── config/                    # Configuration files
├── generated/                 # Generated Prisma client
├── helper/                    # Helper utilities
│   ├── query-builder.ts      # Query construction
│   ├── validation-helper.ts  # Request validation
│   ├── success-handler.ts    # Success responses
│   └── error-handler.ts      # Error handling
├── middleware/               # Express middleware
│   ├── auth.ts              # Authentication
│   ├── cache.ts             # Redis caching
│   └── upload.ts            # File uploads
├── prisma/                  # Database schema and seeds
│   ├── schema/              # Prisma schema files
│   │   ├── project.prisma
│   │   ├── estimation.prisma
│   │   ├── item.prisma
│   │   ├── itemType.prisma  # Item type definitions (NEW)
│   │   ├── category.prisma
│   │   ├── field.prisma
│   │   ├── vendor.prisma
│   │   ├── order.prisma
│   │   └── payslip.prisma
│   ├── seeds/               # Database seeders
│   │   ├── projectSeeder.ts
│   │   ├── estimationSeeder.ts
│   │   ├── itemSeeder.ts
│   │   ├── itemTypeSeeder.ts   # (NEW)
│   │   ├── categorySeeder.ts
│   │   ├── fieldSeeder.ts
│   │   └── ...
│   └── seed.ts              # Main seeder orchestrator
├── tests/                   # Comprehensive test suites
│   ├── project.controller.spec.ts
│   ├── estimation.controller.spec.ts
│   ├── item.controller.spec.ts
│   ├── itemType.controller.spec.ts  # (NEW)
│   ├── field.controller.spec.ts
│   └── ...
├── utils/                   # Utility functions
│   ├── calculations.ts     # Financial calculations
│   ├── activityLogger.ts   # Activity logging
│   └── auditLogger.ts      # Audit trail
├── zod/                    # Zod validation schemas
│   ├── project.zod.ts
│   ├── estimation.zod.ts
│   ├── item.zod.ts
│   ├── itemType.zod.ts    # (NEW)
│   └── ...
└── docs/                   # API documentation
    ├── USER_JOURNEY.md     # End-to-End Workflow & Scenarios
    └── frontend_integration_guide.md

## 📚 Documentation
- **[User Journey & Workflow](docs/USER_JOURNEY.md)** - Complete guide from project creation to financial tracking.
- **[Frontend Integration](docs/frontend_integration_guide.md)** - Technical guide for implementing the API.
- **[Migration Guide](docs/MIGRATION_GUIDE_TRANSACTION_NUMBERS.md)** - Details on recent breaking changes.
```

## 📊 Database Schema - ER Diagram

```text
┌──────────────────┐
│     PROJECT      │
│──────────────────│
│ id (PK)          │
│ name             │
│ description      │
│ type             │
│ code (UK)        │
│ status           │
│ isDeleted        │
│ createdAt        │
│ updatedAt        │
└────────┬─────────┘
         │ 1
         │
         │ N
         ▼
┌─────────────────────────────┐
│       ESTIMATION            │
│─────────────────────────────│
│ id (PK)                     │
│ estimationNumber (UK)       │
│ name                        │
│ projectId (FK)              │
│ estimatedCost               │
│ actualCost                  │
│ marginPercentage            │
│ marginAmount                │
│ projectedWithMargin         │
│ projectedProjectNet         │
│ status                      │
│ metadata (JSON)             │◄─── Contains CAPEX/OPEX/MISC breakdown
│   ├─ categorySubtotals      │     and item counts
│   ├─ typeBreakdown          │
│   └─ itemCounts             │
│ isDeleted                   │
│ createdAt                   │
│ updatedAt                   │
└──────────┬──────────────────┘
           │ 1
           │
           │ N
           ▼
┌─────────────────────────────────┐         ┌──────────────────┐
│           ITEM                  │ N       │    ITEMTYPE      │
│─────────────────────────────────│◄────────│──────────────────│
│ id (PK)                         │         │ id (PK)          │
│ estimationId (FK)               │         │ name             │
│ categoryId (FK)  ──────┐        │         │ description      │
│ itemTypeId (FK)  ───────────────┼────────►│ icon             │
│ itemName                │       │         │ defaultFields    │
│ estimatedQuantity       │       │         │ status           │
│ actualQuantity          │       │         │ items (reverse)  │
│ estimatedUnitPrice      │       │         │ isDeleted        │
│ estimatedTotal          │       │         │ createdAt        │
│ actualUnitPrice         │       │         │ updatedAt        │
│ actualTotal             │       │         └──────────────────┘
│ documentUrls[]          │       │               ▲
│ fields (ItemFields)     │       │               │
│   ├─ common[]           │       │         Built-in Types:
│   └─ custom[]           │       │         - CAPEX (Financial)
│ status                  │       │         - OPEX (Financial)
│ startDate               │       │         - MISC (Financial)
│ endDate                 │       │         - Task, Bug, Feature
│ estimationPoints        │       │         - Epic, Story, Milestone
│ orderId (FK)            │       │         - Risk, Deliverable, etc.
│ parentItemId (FK)       │       │
│ isNewAddition           │       │
│ isDeleted               │       │
│ createdAt               │       │
│ updatedAt               │       │
└─────────────────────────┬───────┘
                          │
                          │ N
                          │
                          ▼
                    ┌──────────────┐
                    │  CATEGORY    │
                    │──────────────│
                    │ id (PK)      │
                    │ name         │
                    │ description  │
                    │ color        │
                    │ isActive     │
                    │ isDeleted    │
                    │ createdAt    │
                    │ updatedAt    │
                    └──────────────┘


┌──────────────────┐         ┌──────────────────┐
│      ORDER       │ N       │     VENDOR       │
│──────────────────│◄────────│──────────────────│
│ id (PK)          │         │ id (PK)          │
│ orderNumber (UK) │         │ vendorId (UK)    │
│ estimationId (FK)│         │ name             │
│ vendorId (FK)    │─────────┤ contactPerson    │
│ itemName         │         │ email            │
│ quantity         │         │ phone            │
│ deliveryDate     │         │ address          │
│ receivedBy       │         │ notes            │
│ condition        │         │ isDeleted        │
│ hasWarranty      │         │ createdAt        │
│ warrantyInfo     │         │ updatedAt        │
│ status           │         └──────────────────┘
│ remarks          │
│ isDeleted        │
│ createdAt        │
│ updatedAt        │
└──────────────────┘


┌──────────────────┐         ┌──────────────────┐
│     PAYSLIP      │         │      FIELD       │
│──────────────────│         │──────────────────│
│ id (PK)          │         │ id (PK)          │
│ payslipNumber(UK)│         │ name             │
│ estimationId (FK)│         │ type             │
│ userId           │         │ category         │
│ amount           │         │ value (JSON)     │
│ paymentDate      │         │ isDeleted        │
│ notes            │         │ createdAt        │
│ isDeleted        │         │ updatedAt        │
│ createdAt        │         └──────────────────┘
│ updatedAt        │
└──────────────────┘         Field Types:
                             - singletext
                             - multitext
                             - number
                             - date
                             - singleselect
                             - multipleselect
                             - iteration
                             - user
                             - calculated
                             - item
                             - object
```

## 🔧 Installation & Setup

### Prerequisites
- Node.js 20.x or higher
- MongoDB instance, or Docker if you want the bundled local database service
- Redis (optional, for caching)
- pnpm package manager

### Installation Steps

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Environment Configuration**
   Create a `.env` file with the following variables:
   ```env
   DATABASE_URL="mongodb://localhost:27017/bnpi_pats"
   PORT=3000
   JWT_SECRET="your-secret-key"
   ENABLE_TEST_MODE=true
   CORS_ORIGINS="http://localhost:5173"
   REDIS_ENABLED=false
   REDIS_URL="redis://localhost:6379"
   SSO_BASE_URL="http://localhost:3000/api"
   CLOUDINARY_CLOUD_NAME="your-cloud-name"
   CLOUDINARY_API_KEY="your-api-key"
   CLOUDINARY_API_SECRET="your-api-secret"
   ```
   `ENABLE_TEST_MODE=true` keeps local development self-contained by bypassing the remote auth dependency.
   `REDIS_ENABLED=false` lets the API boot without a Redis instance.

3. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

4. **Seed Database**
   ```bash
   pnpm run prisma-seed
   ```

5. **Build Application**
   ```bash
   pnpm run build
   ```

6. **Start Development Server**
   ```bash
   pnpm run dev
   ```

If you want the local infrastructure to come up in containers instead of using a host MongoDB install, run `docker compose up --build -d`. That stack now starts MongoDB, Redis, and the API together.

## 📡 API Endpoints

### Project Module
- `POST /api/project` - Create new project
- `GET /api/project` - Get all projects (with filtering, pagination, sorting)
- `GET /api/project/:id` - Get project by ID
- `PATCH /api/project/:id` - Update project
- `DELETE /api/project/:id` - Soft delete project

### Estimation Module
- `POST /api/estimation` - Create new estimation
- `GET /api/estimation` - Get all estimations
- `GET /api/estimation/:id` - Get estimation by ID
- `PATCH /api/estimation/:id` - Update estimation
- `DELETE /api/estimation/:id` - Soft delete estimation

### Item Module
- `POST /api/item` - Create new item
- `GET /api/item` - Get all items
- `GET /api/item/:id` - Get item by ID
- `PATCH /api/item/:id` - Update item
- `DELETE /api/item/:id` - Soft delete item

### ItemType Module (NEW)
- `POST /api/item-type` - Create new item type
- `GET /api/item-type` - Get all item types (filterable by status)
- `GET /api/item-type/:id` - Get item type by ID
- `PATCH /api/item-type/:id` - Update item type
- `DELETE /api/item-type/:id` - Soft delete item type

### Field Module
- `POST /api/field` - Create new field
- `GET /api/field` - Get all fields
- `GET /api/field/:id` - Get field by ID
- `PATCH /api/field/:id` - Update field
- `DELETE /api/field/:id` - Soft delete field

### Category Module
- `POST /api/category` - Create new category
- `GET /api/category` - Get all categories
- `GET /api/category/:id` - Get category by ID
- `PATCH /api/category/:id` - Update category
- `DELETE /api/category/:id` - Soft delete category

### Vendor Module
- `POST /api/vendor` - Create new vendor
- `GET /api/vendor` - Get all vendors
- `GET /api/vendor/:id` - Get vendor by ID
- `PATCH /api/vendor/:id` - Update vendor
- `DELETE /api/vendor/:id` - Soft delete vendor

### Order Module
- `POST /api/order` - Create new order
- `GET /api/order` - Get all orders
- `GET /api/order/:id` - Get order by ID
- `PATCH /api/order/:id` - Update order
- `DELETE /api/order/:id` - Soft delete order

### Payslip Module
- `POST /api/payslip` - Create new payslip
- `GET /api/payslip` - Get all payslips
- `GET /api/payslip/:id` - Get payslip by ID
- `PATCH /api/payslip/:id` - Update payslip
- `DELETE /api/payslip/:id` - Soft delete payslip

## 🧪 Testing

The project includes comprehensive test suites for all modules:

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test -- tests/itemType.controller.spec.ts
```

### Test Coverage
- **25+ test cases** for ItemType module
- **CRUD operations** testing for all modules
- **Validation testing** for all input scenarios
- **Error handling** testing for edge cases
- **Soft delete** functionality testing
- **Filtering, sorting, pagination** testing

## 🌱 Database Seeding

The project includes comprehensive seeders for all modules:

```bash
# Run all seeders
pnpm run prisma-seed
```

### Seeded Data
- **Templates** - Project and estimation templates
- **Sequentials** - Auto-increment configurations
- **Projects** - Sample projects
- **Categories** - Expense categories
- **Fields** - 20+ predefined fields (common & custom)
- **ItemTypes** - 15 item types including CAPEX, OPEX, MISC (NEW)
- **Estimations** - Sample estimations with metadata
- **Vendors** - Sample vendor records
- **Orders** - Sample purchase orders
- **Items** - Sample items with hierarchy
- **Payslips** - Sample payslip records

## 💰 Financial Calculations

The system automatically calculates financial breakdowns:

### CAPEX/OPEX/MISC Breakdown
Items are categorized by `itemTypeId` relation:
- **CAPEX** - Capital Expenditure (long-term investments)
- **OPEX** - Operating Expenditure (day-to-day costs)
- **MISC** - Miscellaneous expenses

### Automatic Calculations
The `updateEstimationTotalsAndMetadata()` function automatically:
1. Calculates total estimated and actual costs
2. Groups costs by category
3. Breaks down costs by item type (CAPEX/OPEX/MISC)
4. Counts items with actuals and new additions
5. Stores all metadata in `estimation.metadata` JSON field

### Metadata Structure
```json
{
  "categorySubtotals": {
    "categoryId": {
      "estimated": 10000,
      "actual": 9500
    }
  },
  "typeBreakdown": {
    "CAPEX": {
      "estimated": 50000,
      "actual": 48000
    },
    "OPEX": {
      "estimated": 20000,
      "actual": 19500
    },
    "MISC": {
      "estimated": 5000,
      "actual": 4800
    }
  },
  "itemCounts": {
    "total": 45,
    "withActuals": 38,
    "newAdditions": 3
  }
}
```

## 🔐 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Role-Based Authorization** - Fine-grained access control
- **Rate Limiting** - Prevent API abuse
- **Input Validation** - Comprehensive Zod validation
- **SQL Injection Protection** - Prisma ORM parameterized queries
- **CORS Protection** - Configurable CORS policies
- **Helmet Security** - HTTP header security
- **Audit Logging** - Complete audit trail for all operations

## 📈 Performance Features

- **Redis Caching** - 5-minute cache TTL for frequently accessed data
- **Query Optimization** - Efficient database queries with proper indexing
- **Pagination** - Limit result sets for better performance
- **Field Selection** - Select only required fields
- **Lazy Loading** - Load related data only when needed

## 🐳 Docker Support

```bash
# Build and start
docker compose up --build -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## 📝 Development Commands

```bash
pnpm run dev              # Start development server with hot reload
pnpm run build            # Production build
pnpm test                 # Run test suite
pnpm run prisma-seed      # Seed database
npx prisma generate       # Generate Prisma client
npx prisma studio         # Open Prisma Studio (database GUI)
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 20.x
- **Language**: TypeScript 5.x
- **Framework**: Express.js
- **Database**: MongoDB with Prisma ORM
- **Validation**: Zod
- **Testing**: Mocha + Chai
- **Caching**: Redis
- **Real-time**: Socket.IO
- **Authentication**: JWT
- **File Upload**: Multer + Cloudinary
- **Logging**: Winston + Logtail
- **Documentation**: OpenAPI/Swagger

## 🎯 Project Milestones

### ✅ Phase 1: Core Foundation (Completed)
- [x] Project scaffolding and architecture setup
- [x] MongoDB integration with Prisma ORM
- [x] Express.js REST API framework
- [x] TypeScript configuration and type safety
- [x] Authentication & authorization (JWT)
- [x] Logging system (Winston + Logtail)
- [x] Error handling and validation (Zod)
- [x] Redis caching layer
- [x] Docker containerization

### ✅ Phase 2: Core Modules (Completed)
- [x] Project management module
- [x] Estimation system with financial calculations
- [x] Item management with hierarchies
- [x] Category management
- [x] Vendor management
- [x] Order processing
- [x] Payslip tracking
- [x] Template system
- [x] Sequential number generators

### ✅ Phase 3: Advanced Features (Completed)
- [x] Dynamic field system (11+ field types)
- [x] ItemType categorization system
- [x] CAPEX/OPEX/MISC financial breakdown
- [x] Automatic metadata calculations
- [x] Category subtotals
- [x] Item hierarchy (parent-child)
- [x] Document upload (Cloudinary)
- [x] Comprehensive test suites (25+ tests per module)
- [x] Database seeders for all modules
- [x] OpenAPI/Swagger documentation

### 🚧 Phase 4: Enhanced Features (In Progress)
- [ ] User management and roles
- [ ] Real-time notifications (Socket.IO)
- [ ] Advanced reporting and analytics
- [ ] Export functionality (PDF, Excel)
- [ ] Budget vs Actual variance reporting
- [ ] Timeline and Gantt chart data
- [ ] Resource management tracking
- [ ] Multi-currency support

### 📋 Phase 5: Integration & Optimization (Planned)
- [ ] Email notifications
- [ ] Webhook support
- [ ] API rate limiting per user
- [ ] Advanced caching strategies
- [ ] Database query optimization
- [ ] GraphQL API layer
- [ ] Batch operations API
- [ ] Data import/export wizards

### 🔮 Phase 6: Enterprise Features (Future)
- [ ] Multi-tenant architecture
- [ ] Advanced permission system (RBAC)
- [ ] Workflow automation
- [ ] Custom dashboard builder
- [ ] Mobile app API endpoints
- [ ] Third-party integrations (Slack, Teams, etc.)
- [ ] AI-powered cost predictions
- [ ] Advanced analytics and forecasting

### 📊 Progress Summary
- **Completed**: 35+ features
- **In Progress**: 8 features
- **Planned**: 16+ features
- **Code Coverage**: 70%+ (unit tests)
- **API Endpoints**: 45+ endpoints
- **Database Models**: 12 models

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏷️ Keywords

`production-tracking`, `assembly-tracking`, `manufacturing`, `estimation-system`, `cost-tracking`, `mongodb`, `prisma`, `typescript`, `express`, `rest-api`, `capex-opex`, `financial-breakdown`, `audit-logging`, `dynamic-fields`, `vendor-management`, `order-processing`, `payroll-tracking`

