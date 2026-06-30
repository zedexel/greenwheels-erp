### greenwheels

ERPNext Customisations for Green Wheels Transport and Contracting LLC

### Custom UI (React)

Green Wheels includes a React frontend at `/greenwheels` with login, dashboard, sidebar navigation, Master Data list/form, and Masters pages (Projects, Suppliers, Customers, Items).

**React routes**

| Route | Description |
|-------|-------------|
| `/greenwheels/` | Dashboard |
| `/greenwheels/master-data` | Master Data list |
| `/greenwheels/master-data/create` | New Master Data form |
| `/greenwheels/master-data/:name` | Edit/view Master Data |
| `/greenwheels/masters/projects` | Projects list |
| `/greenwheels/masters/suppliers` | Suppliers list |
| `/greenwheels/masters/customers` | Customers list |
| `/greenwheels/masters/items` | Items list |

Link fields in the Master Data form include **+ New** shortcuts that open the corresponding master create page and return with the new value selected.

There are **two URLs** — do not mix them up:

| Mode | URL | Command |
|------|-----|---------|
| **Development** | `http://mysite.local:8080/greenwheels/` | `cd frontend && yarn dev` (with `bench start` running) |
| **Production** | `http://mysite.local:8000/greenwheels` | `cd frontend && yarn build` then `bench --site mysite.local clear-cache` |

`localhost` also works for both after the dev proxy cookie fix.

**Development setup**

1. Add `"ignore_csrf": 1` to your site's `site_config.json` (dev only).
2. Start bench: `bench start`
3. Start the frontend dev server:

```bash
cd apps/greenwheels/frontend
yarn
yarn dev
```

Open `http://mysite.local:8080/greenwheels/`

**Production build** (for port 8000 / Frappe server)

```bash
cd apps/greenwheels/frontend
yarn build
bench --site mysite.local clear-cache
```

Then open `http://mysite.local:8000/greenwheels`

If you see a blank page on port 8000, you likely need to run `yarn build` again — that port serves the built files from `greenwheels/public/greenwheels/`, not the live Vite dev server.

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/zedexel/greenwheels-erp
bench install-app greenwheels
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/greenwheels
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

mit
