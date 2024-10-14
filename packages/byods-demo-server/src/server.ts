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

const app = express();

let organizationId = 'asdsads';
let sdk = new BYODS.BYODS({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  tokenStorageAdapter: undefined,
});
let baseClient = sdk.getClientForOrg(organizationId);

// **** Functions **** //
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

// Handle config form submission
app.post('/config', (req: Request, res: Response) => {
  const {clientId, clientSecret, orgId} = req.body;
  const mockSDKConfig = {
    clientId,
    clientSecret,
    tokenStorageAdapter: undefined,
  };
  sdk = new BYODS.BYODS(mockSDKConfig);
  organizationId = orgId;
  baseClient = sdk.getClientForOrg(organizationId);
  res.redirect('/data-source');
});

// Handle token refresh
app.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const tokenManager = sdk.tokenManager;
    await tokenManager.refreshServiceAppAccessToken(organizationId);
    res.send('Token refreshed successfully');
  } catch (error) {
    res.status(500).send(`Error refreshing token: ${error.message}`);
  }
});

// Render the data source page
app.get('/data-source', (req: Request, res: Response) => {
  renderTemplate(res, 'data-source', {title: 'Data Source'});
});

// Handle CRUD operations for data source
app.post('/api/data-source/add', async (req: Request, res: Response) => {
  try {
    const {data} = req.body;
    const response = await baseClient.post('/data-source', {data});
    res.status(201).json({message: 'Data added successfully', data: response.data});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

app.put('/api/data-source/update', async (req: Request, res: Response) => {
  try {
    const {data} = req.body;
    const response = await baseClient.put(`/data-source/${data.id}`, {data});
    res.json({message: 'Data updated successfully', data: response.data});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

app.delete('/api/data-source/delete/:id', async (req: Request, res: Response) => {
  try {
    const {id} = req.params;
    const response = await baseClient.delete(`/data-source/${id}`);
    res.json({message: 'Data deleted successfully', data: response.data});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

app.get('/api/data-source/all', async (req: Request, res: Response) => {
  try {
    const response = await baseClient.get('/data-source');
    res.json(response.data);
  } catch (error) {
    res.status(500).json({error: error.message});
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
