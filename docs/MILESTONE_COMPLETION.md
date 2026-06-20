# Milestone Completion Based on Items

## Overview

Milestones are automatically updated based on the status of their associated items. This document explains how milestone completion works and when milestones are updated.

### Multiple Milestones Per Project

**Important**: A project can have **multiple milestones**, and each milestone tracks its own items independently:

- Each **item** belongs to **one milestone** (via `milestoneId`)
- Each **milestone** can have **multiple items**
- Each **project** can have **multiple milestones**
- When an item changes, **only its specific milestone** is updated (not all milestones in the project)

**Example:**
```
Project: "Website Redesign"
├── Milestone 1: "Design Phase" (3 items)
│   ├── Item A (COMPLETED)
│   ├── Item B (IN_PROGRESS)
│   └── Item C (PENDING)
│   → Progress: 33% | Status: IN_PROGRESS
│
├── Milestone 2: "Development Phase" (5 items)
│   ├── Item D (PENDING)
│   ├── Item E (PENDING)
│   ├── Item F (PENDING)
│   ├── Item G (PENDING)
│   └── Item H (PENDING)
│   → Progress: 0% | Status: NOT_STARTED
│
└── Milestone 3: "Testing Phase" (2 items)
  ├── Item I (COMPLETED)
  └── Item J (COMPLETED)
  → Progress: 100% | Status: COMPLETED
```

When Item B changes from IN_PROGRESS to COMPLETED, **only Milestone 1** is updated. Milestones 2 and 3 remain unchanged.

## How It Works

### Automatic Updates

Milestones are automatically updated whenever:
1. **An item is created** and assigned to a milestone
2. **An item's status changes** (PENDING → IN_PROGRESS → COMPLETED)
3. **An item is deleted** (soft delete) from a milestone
4. **An item's milestone assignment changes**

### Progress Calculation

Milestone progress is calculated as a percentage (0-100) based on completed items:

```
Progress = (Completed Items / Active Items) × 100
```

**Active Items** = Total Items - Cancelled Items

**Example:**
- Total items: 10
- Completed: 6
- In Progress: 2
- Pending: 1
- Cancelled: 1
- **Progress** = (6 / 9) × 100 = **66%**

### Status Logic

Milestone status is automatically determined based on item statuses:

| Condition | Milestone Status |
|-----------|----------------|
| All items are COMPLETED | `COMPLETED` |
| At least one item is IN_PROGRESS or COMPLETED (but not all completed) | `IN_PROGRESS` |
| All items are PENDING | `NOT_STARTED` |
| All items are CANCELLED | `CANCELLED` |
| Manually set | `ON_HOLD` (not auto-updated) |

### Special Behaviors

1. **ON_HOLD Status**: If a milestone is manually set to `ON_HOLD`, the status will NOT be automatically updated. Only the progress percentage will be recalculated.

2. **Completed Date**: When a milestone becomes `COMPLETED`, the `completedDate` field is automatically set to the current date/time.

3. **Start Date**: When a milestone moves from `NOT_STARTED` to `IN_PROGRESS`, the `startDate` field is automatically set if it wasn't already set.

4. **Cancelled Items**: Cancelled items are excluded from progress calculations but still count toward the total.

## Implementation Details

### Functions

#### `calculateMilestoneProgressFromItems(items)`
Calculates milestone progress and suggested status based on items.

**Parameters:**
- `items`: Array of items with `status` field

**Returns:**
```typescript
{
  progress: number,           // 0-100 percentage
  suggestedStatus: string,    // NOT_STARTED | IN_PROGRESS | COMPLETED | CANCELLED
  statusBreakdown: {
    total: number,
    completed: number,
    inProgress: number,
    pending: number,
    cancelled: number
  }
}
```

#### `updateMilestoneFromItems(prisma, milestoneId, options)`
Updates a milestone's progress and status based on its items.

**Parameters:**
- `prisma`: PrismaClient instance
- `milestoneId`: ID of the milestone to update
- `options`: Optional configuration
  - `forceStatusUpdate`: If true, will update status even if milestone is ON_HOLD
  - `setCompletedDate`: If true, will set completedDate when milestone becomes COMPLETED

**Returns:**
```typescript
{
  milestone: Milestone,
  updated: boolean
} | null
```

#### `updateMilestonesForItem(prisma, itemId)`
Updates the milestone that contains the given item. Called automatically when an item changes.

**Note**: Since each item belongs to only one milestone, this updates a single milestone.

**Parameters:**
- `prisma`: PrismaClient instance
- `itemId`: ID of the item that changed

#### `updateAllMilestonesForProject(prisma, projectId, options)`
Updates all milestones for a given project. Useful for bulk recalculation or when you need to refresh all milestone progress.

**Parameters:**
- `prisma`: PrismaClient instance
- `projectId`: ID of the project
- `options`: Optional configuration (same as `updateMilestoneFromItems`)

**Returns:**
```typescript
{
  updated: number,        // Number of milestones updated
  total: number          // Total milestones in project
}
```

## Usage Examples

### Manual Milestone Update

If you need to manually recalculate a milestone's progress and status:

```typescript
import { updateMilestoneFromItems } from '../utils/calculations';

// Update milestone based on its items
const result = await updateMilestoneFromItems(prisma, milestoneId, {
  forceStatusUpdate: false,  // Don't override ON_HOLD
  setCompletedDate: true      // Set completedDate when completed
});

if (result?.updated) {
  console.log('Milestone updated:', result.milestone);
}
```

### Force Status Update (Even if ON_HOLD)

```typescript
const result = await updateMilestoneFromItems(prisma, milestoneId, {
  forceStatusUpdate: true,  // Override ON_HOLD status
  setCompletedDate: true
});
```

### Calculate Progress Without Updating

```typescript
import { calculateMilestoneProgressFromItems } from '../utils/calculations';

const milestone = await prisma.milestone.findUnique({
  where: { id: milestoneId },
  include: { items: { select: { status: true } } }
});

const { progress, suggestedStatus, statusBreakdown } = 
  calculateMilestoneProgressFromItems(milestone.items);

console.log(`Progress: ${progress}%`);
console.log(`Suggested Status: ${suggestedStatus}`);
console.log(`Breakdown:`, statusBreakdown);
```

### Update All Milestones for a Project

If you need to recalculate all milestones for a project (e.g., after bulk item updates):

```typescript
import { updateAllMilestonesForProject } from '../utils/calculations';

const result = await updateAllMilestonesForProject(prisma, projectId, {
  forceStatusUpdate: false,
  setCompletedDate: true
});

console.log(`Updated ${result.updated} out of ${result.total} milestones`);
```

## Item Status Flow

Items follow this status flow:

```
PENDING → IN_PROGRESS → COMPLETED
   ↓
CANCELLED (can happen at any stage)
```

### When Items Change Status

1. **PENDING → IN_PROGRESS**: 
   - Milestone moves from `NOT_STARTED` to `IN_PROGRESS` (if all items were pending)
   - Progress increases

2. **IN_PROGRESS → COMPLETED**:
   - Progress increases
   - If all items are completed, milestone becomes `COMPLETED`

3. **Any → CANCELLED**:
   - Cancelled items are excluded from progress calculation
   - If all items are cancelled, milestone becomes `CANCELLED`

## Integration Points

The milestone update logic is automatically integrated into:

- **`item.service.ts`**:
  - `createItem()` - Updates milestone when item is created
  - `updateItem()` - Updates milestone when item status changes
  - `deleteItem()` - Updates milestone when item is deleted
  - `updateActualPriceWithDocuments()` - Updates milestone when item actuals change

## Best Practices

1. **Don't manually set milestone status** unless you want to override automatic calculation (e.g., setting to `ON_HOLD`)

2. **Use `ON_HOLD`** when you want to pause milestone tracking without affecting item status

3. **Monitor item statuses** - The milestone will automatically reflect the state of its items

4. **Check dependencies** - Before marking a milestone as complete, ensure dependent milestones are also complete

## Troubleshooting

### Milestone not updating?

1. Check if the item has a `milestoneId` assigned
2. Verify the item's status is changing correctly
3. Check logs for errors in milestone update process
4. Ensure the milestone is not set to `ON_HOLD` (unless using `forceStatusUpdate: true`)

### Progress seems incorrect?

1. Verify cancelled items are being excluded from calculations
2. Check that all items are properly associated with the milestone
3. Ensure items are not soft-deleted (`isDeleted: false`)

### Status not changing to COMPLETED?

1. Verify ALL active items have status `COMPLETED`
2. Check if milestone is set to `ON_HOLD` (won't auto-update)
3. Ensure no items are stuck in `IN_PROGRESS` or `PENDING`
