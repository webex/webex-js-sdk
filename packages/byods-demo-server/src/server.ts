import express, {Request, Response, NextFunction} from 'express';
import logger from 'jet-logger';
import * as BYODS from '@webex/byods/src/index';
import 'express-async-errors';
import path from 'path';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import handlebars from 'handlebars';
import fs from 'fs';

// **** Core Setup **** //
const app = express();

let sdk: BYODS.BYODS;
const refreshSchedules = new Set<{cancel: () => void}>();

// **** Helper Functions **** //
// Function to render Handlebars templates
function renderTemplate(res: Response, templateName: string, data: any) {
  const templatePath = path.join(__dirname, 'views', `${templateName}.hbs`);
  fs.readFile(templatePath, 'utf-8', (err, source) => {
    if (err) {
      res.status(500).send('Error reading template');

      return;
    }
    const template = handlebars.compile(source);
    const html = template(data);
    res.send(html);
  });
}

// **** Setup **** //

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser(''));

// Show routes called in console during development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Security
if (process.env.NODE_ENV === 'production') {
  app.use(helmet());
}

// Set up Handlebars
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Redirect everything to the config page
app.get('/', (req: Request, res: Response) => {
  res.redirect('/config');
});

// Render the config page
app.get('/config', (req: Request, res: Response) => {
  renderTemplate(res, 'config', {});
});

// **** Configuration **** //
// Handle config form submission
app.post('/config', async (req: Request, res: Response) => {
  const {clientId, clientSecret, orgId, refreshToken} = req.body;
  try {
    const configuredSdk = new BYODS.BYODS({
      clientId,
      clientSecret,
      orgId,
      tokenStorageAdapter: new BYODS.InMemoryTokenStorageAdapter(),
      logger: {level: BYODS.LOGGER.LOG},
    });
    await configuredSdk.tokenManager.saveServiceAppRegistrationData(refreshToken);

    // Cancel active JWS schedules before applying the configuration.
    refreshSchedules.forEach((schedule) => schedule.cancel());
    refreshSchedules.clear();
    sdk = configuredSdk;
    res.redirect('/data-source');
  } catch (error) {
    renderTemplate(res.status(400), 'config', {errorMessage: error.message});
  }
});

app.use((req: Request, res: Response, next: NextFunction) => {
  if (!sdk) {
    if (req.path.startsWith('/api/')) {
      res.status(409).json({error: 'Configure the SDK first.'});
    } else {
      res.redirect('/config');
    }

    return;
  }
  next();
});

// Render the data sources for the configured organization.
app.get('/data-source', async (req: Request, res: Response) => {
  try {
    const configuredSdk = sdk;
    const {data: dataSources} = await configuredSdk.dataSource.list();
    renderTemplate(res, 'data-source', {
      title: 'Data Sources',
      orgId: configuredSdk.orgId,
      dataSources,
    });
  } catch (error) {
    res.status(400).send(`Error fetching data sources: ${error.message}`);
  }
});

// **** Data Source Client CRUD Operations **** //
// Handle CRUD operations for data source
app.post('/api/data-source/add', async (req: Request, res: Response) => {
  try {
    const {schemaId, url, audience, subject, nonce, tokenLifetimeMinutes} = req.body;
    const dataSourcePayload = {schemaId, url, audience, subject, nonce, tokenLifetimeMinutes};
    const response = await sdk.dataSource.create(dataSourcePayload);
    res.status(201).json({message: 'Data source added successfully', data: response.data});
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

app.post('/api/data-source/update', async (req: Request, res: Response) => {
  try {
    const {
      id,
      schemaId,
      url,
      audience,
      subject,
      nonce,
      tokenLifetimeMinutes,
      status,
      errorMessage,
    } = req.body;
    const dataSourcePayload = {
      schemaId,
      tokenLifetimeMinutes,
      url,
      subject,
      audience,
      nonce,
      status,
      errorMessage,
    };
    const response = await sdk.dataSource.update(id, dataSourcePayload);
    res.status(201).json({message: 'Data updated successfully', data: response.data});
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

app.delete('/api/data-source/delete/:id', async (req: Request<{id: string}>, res: Response) => {
  try {
    const {id} = req.params;
    const response = await sdk.dataSource.delete(id);
    res.status(204).json({message: 'Data deleted successfully', data: response.data});
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

// JWS Token refresh
// Handle JWS token refresh
app.post(
  '/api/data-source/refresh-token/:id',
  async (req: Request<{id: string}>, res: Response) => {
    try {
      const {id} = req.params;
      const {tokenLifetimeMinutes} = req.body;
      const schedule = await sdk.dataSource.scheduleJWSTokenRefresh(id, tokenLifetimeMinutes, () =>
        crypto.randomUUID()
      ); // Use UUID for nonce
      refreshSchedules.add(schedule);
      res.status(200).json({message: 'JWS token refresh scheduled successfully'});
    } catch (error) {
      res.status(400).json({error: error.message});
    }
  }
);

// JWS Token verification
app.post('/api/data-source/verify-jws-token', async (req: Request, res: Response) => {
  try {
    const {jws} = req.body;
    const response = await sdk.verifyJWSToken(jws);
    res.status(200).json({message: 'JWS token verified successfully', data: response});
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

// Error handler
app.use((err: Error, _: Request, res: Response, next: NextFunction) => {
  logger.err(err, true);
  res.status(400).json({error: err.message});
  next(err);
});

// **** Export default **** //

export default app;
