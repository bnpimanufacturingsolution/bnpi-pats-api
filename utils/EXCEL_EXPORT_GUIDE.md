# Excel Export Guide

## Overview

The Excel export functionality allows you to export data from any entity to Excel format (.xlsx files). This guide shows you how to use the export utility in your controllers.

## Installation

The `xlsx` package has been installed in the backend:

```bash
pnpm add xlsx
```

## Usage

### 1. Import the Export Utilities

In your controller file, import the export functions:

```typescript
import { exportToExcel, formatDataForExcel } from "../../utils/excelExporter";
```

### 2. Create an Export Method

Add an export method to your controller:

```typescript
const exportExcel = async (req: Request, res: Response, _next: NextFunction) => {
  try {
    // Get your data (example with projects)
    const data = await repository.getAll(/* your query params */);

    // Format data for Excel (handles dates, objects, arrays, etc.)
    const formattedData = formatDataForExcel(data);

    // Define column headers (optional - makes headers more readable)
    const columnHeaders = {
      id: "ID",
      name: "Name",
      createdAt: "Created At",
      // Add more mappings as needed
    };

    // Specify fields to export (optional - controls order and selection)
    const fields = ["name", "description", "createdAt"];

    // Export to Excel
    exportToExcel(res, formattedData, {
      filename: `my-export-${new Date().toISOString().split("T")[0]}`,
      sheetName: "Sheet1",
      columnHeaders,
      fields,
    });
  } catch (error) {
    logger.error(`Export failed: ${error}`);
    res.status(500).json(buildErrorResponse("Export failed", 500));
  }
};
```

### 3. Update Controller Interface

Add the export method to your controller interface:

```typescript
interface IController {
  // ... existing methods
  exportExcel(req: Request, res: Response, next: NextFunction): Promise<void>;
}
```

### 4. Add Route

Add an export route in your router file:

```typescript
/**
 * @openapi
 * /api/your-entity/export/excel:
 *   get:
 *     summary: Export data to Excel
 *     tags: [YourEntity]
 *     responses:
 *       200:
 *         description: Excel file downloaded
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
routes.get("/export/excel", controller.exportExcel);
```

### 5. Export from Controller

Make sure to export the method:

```typescript
return {
  create,
  getAll,
  getById,
  update,
  remove,
  exportExcel  // Add this
};
```

## API Options

### `exportToExcel(res, data, options)`

**Parameters:**
- `res`: Express Response object
- `data`: Array of objects to export
- `options`: Configuration object

**Options:**
- `filename` (required): Filename without extension (e.g., "projects-export-2025-12-22")
- `sheetName` (optional): Name of the Excel sheet (default: "Sheet1")
- `columnHeaders` (optional): Object mapping field names to display names
- `fields` (optional): Array of field names to include (in order)

### `formatDataForExcel(data)`

Automatically formats data for Excel export:
- Converts Date objects to ISO strings
- Converts null/undefined to empty strings
- Converts objects to JSON strings
- Converts arrays to comma-separated strings
- Converts booleans to "Yes"/"No"

## Example: Export Endpoint

The export endpoint has been added to the Project controller. You can test it by calling:

```
GET /api/project/export/excel
```

**Optional Query Parameters:**
- `query`: Search query to filter data
- `filter`: JSON array of filter objects
- `order`: Sort order (asc/desc)
- `sort`: Field to sort by

**Example:**
```
GET /api/project/export/excel?query=construction&order=desc&sort=createdAt
```

## Features

1. **Filtering & Sorting**: Use the same query parameters as your list endpoints
2. **Custom Column Names**: Map technical field names to user-friendly headers
3. **Field Selection**: Choose which fields to export and their order
4. **Auto Formatting**: Dates, objects, and arrays are automatically formatted
5. **Logging**: All exports are logged with activity tracking

## Adding Export to Other Entities

To add export functionality to other entities (Order, Payslip, Vendor, etc.):

1. Follow steps 1-5 above for each entity controller
2. Customize the `columnHeaders` and `fields` for each entity
3. Adjust the filename to include the entity name
4. Update the route path accordingly

## Example: Order Export

```typescript
// In order.controller.ts
const exportExcel = async (req: Request, res: Response, _next: NextFunction) => {
  const orders = await repository.getAll(/* query */);
  const formattedData = formatDataForExcel(orders);

  exportToExcel(res, formattedData, {
    filename: `orders-export-${new Date().toISOString().split("T")[0]}`,
    sheetName: "Orders",
    columnHeaders: {
      id: "Order ID",
      projectId: "Project",
      amount: "Amount",
      status: "Status",
      createdAt: "Created At",
    },
    fields: ["id", "projectId", "amount", "status", "createdAt"],
  });
};

// In order.router.ts
routes.get("/export/excel", controller.exportExcel);
```

## Notes

- The export respects your existing filters and search functionality
- Large datasets (>10,000 records) may take time to generate
- The file is sent as a binary download with proper headers
- All exports are logged for audit purposes
