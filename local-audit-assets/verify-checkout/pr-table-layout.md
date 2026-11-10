Product names collapsed to a zero-width column when fixed columns and the 410px actions column exceeded the available content width. This produced vertical lettering and text overlapping the category column at laptop viewport sizes.

Give shared DataTable and SimpleTable a minimum width budget for every column and the actions area, with overflow contained in the table wrapper. Reserve 260px for product names, wrap status chips within their cells, and protect the three handwritten batch-detail tables with matching minimum widths. Existing actions remain accessible by horizontal scrolling.

Validation: reproduced the original failure at 1366px (measured product-name width 0). Added browser regression coverage for both shared table components plus product names/actions at 1024, 1366 and 1536px. All nine browser tests, 35 existing regression tests, production build and targeted ESLint passed. A read-only audit of the shared demo DB covered 39 list/form/detail routes at all three widths (117 views, 84 table views): no zero-width headers, cell-control overlap, page-level overflow or JavaScript exceptions found. Screenshots and the audit report were saved locally under outputs/ui-review-20261107.

Stacked on #77 to retain the prototype promotion fixes. No backend, migration or demo-data changes.
