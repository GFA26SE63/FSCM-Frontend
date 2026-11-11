const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const regionDialogsCode = fs.readFileSync(
  path.resolve(__dirname, '../src/features/regions/components/RegionDialogs.tsx'),
  'utf8',
);
const regionsPageCode = fs.readFileSync(
  path.resolve(__dirname, '../src/features/regions/pages/RegionsPage.tsx'),
  'utf8',
);
const groupDetailPageCode = fs.readFileSync(
  path.resolve(__dirname, '../src/features/regions/pages/GroupDetailPage.tsx'),
  'utf8',
);

test('Rule 1 & 4 & 5: Create Region form does not auto-select manager even if 1 or multiple managers exist', () => {
  // In AreaDialog:
  // Must NOT have setManagerId(managers[0])
  assert.equal(
    regionDialogsCode.includes('setManagerId(managers[0]'),
    false,
    'AreaDialog must not auto-select managers[0]',
  );
  // Must start with setManagerId('') in create mode
  assert.ok(
    regionDialogsCode.includes("setManagerId('');"),
    'AreaDialog must initialize managerId to empty string in create mode',
  );
  // Must have placeholder "Chọn Sales Manager..."
  assert.ok(
    regionDialogsCode.includes('placeholder="Chọn Sales Manager..."'),
    'AreaDialog Select must have placeholder "Chọn Sales Manager..."',
  );
});

test('Rule 2 & 4 & 5: Create Sales Group form does not auto-select Region even if 1 or multiple regions exist', () => {
  // In GroupDialog:
  // Must NOT have setAreaCode(defaultArea) or setAreaCode(areas[0])
  assert.equal(
    regionDialogsCode.includes('setAreaCode(defaultArea)'),
    false,
    'GroupDialog must not auto-select defaultArea',
  );
  assert.equal(
    regionDialogsCode.includes('setAreaCode(areas[0]'),
    false,
    'GroupDialog must not auto-select areas[0]',
  );
  // Must have placeholder "Chọn vùng hoạt động..."
  assert.ok(
    regionDialogsCode.includes('placeholder="Chọn vùng hoạt động..."'),
    'GroupDialog Select must have placeholder "Chọn vùng hoạt động..."',
  );
  // Must have placeholder "Chọn Sales Manager..."
  assert.ok(
    regionDialogsCode.includes('placeholder="Chọn Sales Manager..."'),
    'GroupDialog Select must have placeholder "Chọn Sales Manager..."',
  );
});

test('Rule 3 & 4 & 5: Sales staff transfer does not auto-select employees or destination groups', () => {
  // In TransferStaffDialog:
  // Must NOT fall back to staff[0]
  assert.equal(
    regionDialogsCode.includes('staff[0]'),
    false,
    'TransferStaffDialog must not auto-select staff[0]',
  );
  // Must NOT fall back to destinations[0]
  assert.equal(
    regionDialogsCode.includes('destinations[0]'),
    false,
    'TransferStaffDialog must not auto-select destinations[0]',
  );
  // Placeholders
  assert.ok(
    regionDialogsCode.includes('placeholder="Chọn nhân viên Sales..."'),
    'TransferStaffDialog must have placeholder "Chọn nhân viên Sales..."',
  );
  assert.ok(
    regionDialogsCode.includes('placeholder="Chọn nhóm Sales..."'),
    'TransferStaffDialog must have placeholder "Chọn nhóm Sales..."',
  );
});

test('Rule 8 & 5: Dependent dropdowns start disabled when parent is unselected and clear on change', () => {
  // In GroupDialog: managerId is disabled if !areaCode
  assert.ok(
    regionDialogsCode.includes('disabled={!areaCode}'),
    'GroupDialog manager select must be disabled when areaCode is unselected',
  );
  // In TransferStaffDialog: destination groupId is disabled if !current or destinations.length === 0
  assert.ok(
    regionDialogsCode.includes('disabled={!current || destinations.length === 0}'),
    'TransferStaffDialog destination select must be disabled when current staff is unselected',
  );
});

test('Rule 6: Edit forms retain valid saved values and do not overwrite on async reload', () => {
  // AreaDialog retains area values and uses wasOpenRef to guard against async refreshes
  assert.ok(
    regionDialogsCode.includes('wasOpenRef.current'),
    'RegionDialogs must guard against async updates overwriting user form inputs',
  );
  assert.ok(
    regionDialogsCode.includes('setManagerId(area.managerId ?? \'\');'),
    'AreaDialog must retain existing area.managerId when editing',
  );
  assert.ok(
    regionDialogsCode.includes('setAreaCode(group.areaCode);'),
    'GroupDialog must retain existing group.areaCode when editing',
  );
  assert.ok(
    regionDialogsCode.includes('setManagerId(group.managerId ?? \'\');'),
    'GroupDialog must retain existing group.managerId when editing',
  );
  assert.ok(
    regionDialogsCode.includes('setSelectedMembers(group.members ?? []);'),
    'GroupDialog must retain existing group.members when editing',
  );
});

test('Rule 9 & 10: Sales assignment excludes staff belonging to other groups and keeps current members in Edit mode', () => {
  // availableStaff excludes staff with groupId or groupCode
  assert.ok(
    regionDialogsCode.includes('s.groupId || s.groupCode'),
    'GroupDialog must exclude staff already assigned to any group',
  );
  // currentGroupStaff is preserved in edit mode
  assert.ok(
    regionDialogsCode.includes('currentGroupMembersList'),
    'GroupDialog must keep current group members visible in Edit mode',
  );
});

test('Rule 12: Form validations enforce natural Vietnamese messages', () => {
  assert.ok(
    regionDialogsCode.includes('Vui lòng chọn vùng hoạt động.'),
    'GroupDialog must validate area with "Vui lòng chọn vùng hoạt động."',
  );
  assert.ok(
    regionDialogsCode.includes('Vùng hoạt động đã chọn không còn phù hợp.'),
    'GroupDialog must reject inactive/invalid area with "Vùng hoạt động đã chọn không còn phù hợp."',
  );
  assert.ok(
    regionDialogsCode.includes('Nhân viên này đã thuộc một nhóm Sales khác.'),
    'GroupDialog must reject staff from other groups with "Nhân viên này đã thuộc một nhóm Sales khác."',
  );
  assert.ok(
    regionDialogsCode.includes('Vui lòng chọn nhân viên Sales.'),
    'TransferStaffDialog must validate staff with "Vui lòng chọn nhân viên Sales."',
  );
  assert.ok(
    regionDialogsCode.includes('Vui lòng chọn nhóm Sales.'),
    'TransferStaffDialog must validate destination group with "Vui lòng chọn nhóm Sales."',
  );
});

test('Rule 13: Region deactivation business rule restriction is preserved', () => {
  assert.ok(
    regionsPageCode.includes('Không thể ngừng hoạt động khu vực này vì vẫn còn nhóm Sales đang hoạt động.'),
    'RegionsPage must block region deactivation if it has active sales groups',
  );
});

test('Contextual staff preselection works from row actions and is not forced from header buttons', () => {
  // Header buttons in RegionsPage and GroupDetailPage must not auto-select group.members[0]
  assert.equal(
    regionsPageCode.includes('staffName: group.members[0]'),
    false,
    'RegionsPage row action must not arbitrarily preselect group.members[0]',
  );
  assert.equal(
    groupDetailPageCode.includes('setTransferTarget(g.members[0]'),
    false,
    'GroupDetailPage header button must not arbitrarily preselect g.members[0]',
  );
  // Row button in GroupDetailPage passes specific row member
  assert.ok(
    groupDetailPageCode.includes('setTransferTarget(m.name)'),
    'GroupDetailPage row action must pass contextual staff name m.name',
  );
});

