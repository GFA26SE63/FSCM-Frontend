const { test } =
  require('node:test');
const assert =
  require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const {
  renderToStaticMarkup,
} = require('react-dom/server');

function source(
  file,
  mocks = {},
) {
  const filename = path.resolve(
    __dirname,
    '../src',
    file,
  );

  const code = ts.transpileModule(
    fs.readFileSync(
      filename,
      'utf8',
    ),
    {
      fileName: filename,
      compilerOptions: {
        module:
          ts.ModuleKind.CommonJS,
        target:
          ts.ScriptTarget.ES2020,
        jsx:
          ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;

  const module = {
    exports: {},
  };

  const imports = (name) => {
    if (
      Object.hasOwn(
        mocks,
        name,
      )
    ) {
      return mocks[name];
    }

    if (
      name.startsWith('.') ||
      name.startsWith('@/')
    ) {
      throw new Error(
        `Missing mock: ${name}`,
      );
    }

    return require(name);
  };

  new Function(
    'require',
    'module',
    'exports',
    code,
  )(
    imports,
    module,
    module.exports,
  );

  return module.exports;
}

const errors = source(
  'shared/api/errors.ts',
);

const permissions = source(
  'shared/auth/permissions.ts',
  {
    '../api/errors': errors,
  },
);

const access = source(
  'features/orders/orderAccess.ts',
  {
    '@/shared/auth/permissions':
      permissions,
    '@/shared/api/errors':
      errors,
  },
);

const roles = [
  'Admin',
  'Operator',
  'WarehouseKeeper',
  'SalesManager',
];

const user = (role) => ({
  id: `user-${role}`,
  name: role,
  email: `${role}@example.com`,
  role,
});

test('only Admin and Operator may withdraw an Allocating order', () => {
  for (const role of roles) {
    assert.equal(
      access.canWithdrawOrder(
        user(role),
        {
          status: 'Allocating',
        },
      ),
      ['Admin', 'Operator']
        .includes(role),
    );
  }

  assert.equal(
    access.canWithdrawOrder(
      null,
      {
        status: 'Allocating',
      },
    ),
    false,
  );
});

test('withdraw is unavailable after allocation', () => {
  const statuses = [
    'Quoted',
    'PaymentPending',
    'ConvertedToPo',
    'Picking',
    'Issued',
    'Delivering',
    'Delivered',
    'Withdrawn',
    'QuoteRejected',
    'QuoteExpired',
    'AllocationFailed',
    'OutOfStock',
    'AllocationConflict',
  ];

  for (const status of statuses) {
    assert.equal(
      access.canWithdrawOrder(
        user('Admin'),
        { status },
      ),
      false,
    );

    assert.throws(
      () =>
        access.assertCanWithdrawOrder(
          user('Admin'),
          { status },
        ),
      { status: 409 },
    );
  }
});

test('unauthorized users cannot execute Withdraw rules', () => {
  assert.throws(
    () =>
      access.assertCanWithdrawOrder(
        null,
        {
          status: 'Allocating',
        },
      ),
    { status: 401 },
  );

  assert.throws(
    () =>
      access.assertCanWithdrawOrder(
        user('WarehouseKeeper'),
        {
          status: 'Allocating',
        },
      ),
    { status: 403 },
  );
});

test('OrderActions renders Withdraw only for permitted role and state', () => {
  let currentUser =
    user('Admin');

  const {
    OrderActions,
  } = source(
    'features/orders/components/OrderActions.tsx',
    {
      '@/shared/auth/AuthContext': {
        useAuth: () => ({
          user: currentUser,
        }),
      },

      '@/shared/ui': {
        Button: ({
          children,
        }) =>
          React.createElement(
            'button',
            null,
            children,
          ),
      },

      '../orderAccess': access,

      './OrderDialogs': {
        WithdrawOrderDialog:
          () => null,
      },
    },
  );

  function render(status) {
    return renderToStaticMarkup(
      React.createElement(
        OrderActions,
        null,
        ({ buttons }) =>
          buttons({
            id: 'order-1',
            orderCode: 'SO-1',
            status,
            version: 1,
          }),
      ),
    );
  }

  assert.match(
    render('Allocating'),
    /Rút yêu cầu/,
  );

  assert.doesNotMatch(
    render('Quoted'),
    /Rút yêu cầu/,
  );

  currentUser =
    user('WarehouseKeeper');

  assert.doesNotMatch(
    render('Allocating'),
    /Rút yêu cầu/,
  );
});