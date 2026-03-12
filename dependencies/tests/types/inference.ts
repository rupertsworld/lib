import {
  DependencyContainer,
  createIdentifier,
  injectable,
} from "../../src/index.ts";

class Database {
  query(): string {
    return "ok";
  }
}

class Logger {
  log(): string {
    return "logged";
  }
}

interface AuthService {
  check(): boolean;
}

const dependencies = new DependencyContainer();

dependencies.register(Database);
const database = dependencies.resolve(Database);
const dbCheck: Database = database;
dbCheck.query();

// @ts-expect-error class-key inference should not widen to any
const badDatabase: string = dependencies.resolve(Database);

const AppDb = createIdentifier<Database>("AppDb");
dependencies.register(AppDb, () => new Database());
const appDb = dependencies.resolve(AppDb);
const appDbCheck: Database = appDb;
appDbCheck.query();

// @ts-expect-error identifiers should retain their declared type
const badAppDb: Logger = dependencies.resolve(AppDb);

const IAuth = createIdentifier<AuthService>("IAuth");
dependencies.register(IAuth, () => ({ check: () => true }));
const auth = dependencies.resolve(IAuth);
const authCheck: AuthService = auth;
authCheck.check();

// @ts-expect-error interface identifiers should retain their declared type
const badAuth: Database = dependencies.resolve(IAuth);

dependencies.register("db", () => new Database());
const stringDb = dependencies.resolve<Database>("db");
const stringDbCheck: Database = stringDb;
stringDbCheck.query();

// @ts-expect-error string keys should respect the explicit generic
const badStringDb: Logger = dependencies.resolve<Database>("db");

@injectable(Database, Logger)
class Editor {
  constructor(
    readonly db: Database,
    readonly logger: Logger,
  ) {}
}

dependencies.register(Logger);
dependencies.register(Editor);

const editor = dependencies.resolve(Editor);
const editorCheck: Editor = editor;
editorCheck.db.query();
editorCheck.logger.log();
