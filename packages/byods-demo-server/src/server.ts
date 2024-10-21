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
let baseClient: BYODS.BaseClient;

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
app.use(cookieParser('your-cookie-secret'));

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
  renderTemplate(res, 'config', {title: 'Configuration'});
});

// **** Configuration **** //
// Handle config form submission
app.post('/config', (req: Request, res: Response) => {
  const {clientId, clientSecret} = req.body;
  const mockSDKConfig = {
    clientId,
    clientSecret,
    tokenStorageAdapter: undefined,
    logger: {level: BYODS.LOGGER.INFO},
  };
  sdk = new BYODS.BYODS(mockSDKConfig);
  res.redirect('/orgs');
});

// **** Token Management **** //
// Render the orgs page
app.get('/orgs', (req: Request, res: Response) => {
  renderTemplate(res, 'orgs', {title: 'Organizations'});
});

// Handle saving access token
app.post('/api/token/save', async (req: Request, res: Response) => {
  const {orgId, refreshToken} = req.body;
  try {
    await sdk.tokenManager.saveServiceAppRegistrationData(orgId, refreshToken);
    res.status(201).send('Acess token saved successfully');
  } catch (error) {
    res.status(500).send(`Error saving refresh token: ${error.message}`);
  }
});

// **** Data Source Client Setup **** //
// Render the data source page
app.get('/data-source', async (req: Request, res: Response) => {
  const {orgId} = req.query;
  baseClient = sdk.getClientForOrg(orgId as string);
  try {
    const dataSourcesResponse = await baseClient.dataSource.list();
    const dataSources = dataSourcesResponse.data;
    renderTemplate(res, 'data-source', {title: 'Data Sources', orgId, dataSources});
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
    const response = await baseClient.dataSource.create(dataSourcePayload);
    res.status(201).json({message: 'Data source added successfully', data: response.data});
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

app.post('/api/data-source/update', async (req: Request, res: Response) => {
  try {
    const {id, schemaId, url, audience, subject, nonce, tokenLifetimeMinutes} = req.body;
    const dataSourcePayload = {schemaId, tokenLifetimeMinutes, url, subject, audience, nonce};
    const response = await baseClient.dataSource.update(id, dataSourcePayload);
    res.status(201).json({message: 'Data updated successfully', data: response.data});
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

app.delete('/api/data-source/delete/:id', async (req: Request, res: Response) => {
  try {
    const {id} = req.params;
    const response = await baseClient.dataSource.delete(id);
    res.status(201).json({message: 'Data deleted successfully', data: response.data});
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

// Endpoint to list tokens
app.get('/api/token/list', async (req: Request, res: Response) => {
  try {
    const tokens = await sdk.tokenManager.listTokens();
    res.status(201).json(tokens);
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

// JWS Token refresh
// Handle JWS token refresh
app.post('/api/data-source/refresh-token/:id', async (req: Request, res: Response) => {
  try {
    const {id} = req.params;
    await baseClient.dataSource.scheduleJWSTokenRefresh(id, 60, () => 'test');
    res.status(201).json({message: 'JWS token refreshed scheduled successfully'});
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

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
