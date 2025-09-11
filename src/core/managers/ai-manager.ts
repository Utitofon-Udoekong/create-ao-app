import { logger } from '../utils/logging.js';
import { AIProvider, GenerationOptions, GeneratedCode, ValidationResult } from '../../types/ai.js';
import { AOConfig } from '../../types/aos.js';
import fs from 'fs-extra';
import path from 'path';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface AIGenerationRequest {
  prompt: string;
  type: 'contract' | 'module' | 'test' | 'template' | 'refactor';
  context?: string;
  filePath?: string;
  options?: Partial<GenerationOptions>;
}

export interface AIAnalysisResult {
  suggestions: string[];
  improvements: string[];
  issues: string[];
  complexity: 'low' | 'medium' | 'high';
}

export class AIManager {
  private config: AOConfig;
  private apiKeys: Map<string, string> = new Map();

  constructor(config: AOConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    logger.debug('Initializing AI Manager...');
    
    try {
      // Load API keys from environment or config
      await this.loadAPIKeys();
      
      // Validate AI configuration
      await this.validateConfiguration();
      
      logger.success('AI Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AI Manager:', error as Error);
      throw error;
    }
  }

  async generateCode(request: AIGenerationRequest): Promise<GeneratedCode> {
    logger.info(`Generating ${request.type} code...`);
    
    try {
      // Determine provider and model
      const provider = request.options?.provider || 'openai';
      const model = request.options?.model || this.getDefaultModel(provider);
      
      // Build context-aware prompt
      const enhancedPrompt = await this.buildEnhancedPrompt(request);
      
      // Generate code using AI provider
      const code = await this.callAIProvider(provider, model, enhancedPrompt, request.options);
      
      // Validate generated code
      const validation = await this.validateGeneratedCode(code, request.type);
      
      // Create result
      const result: GeneratedCode = {
        code,
        metadata: {
          provider,
          model,
          type: request.type,
          timestamp: new Date(),
          tokens: 0 // TODO: Get actual token count
        },
        validation
      };
      
      logger.success(`${request.type} code generated successfully`);
      return result;
      
    } catch (error) {
      logger.error('Code generation failed:', error as Error);
      throw error;
    }
  }

  async refactorCode(filePath: string, instructions: string): Promise<GeneratedCode> {
    logger.info(`Refactoring code in ${filePath}...`);
    
    try {
      // Read existing code
      const existingCode = await fs.readFile(filePath, 'utf8');
      
      // Create refactoring request
      const request: AIGenerationRequest = {
        prompt: `Refactor the following code according to these instructions: ${instructions}\n\nCode:\n${existingCode}`,
        type: 'refactor',
        context: `File: ${filePath}`,
        filePath
      };
      
      return await this.generateCode(request);
      
    } catch (error) {
      logger.error('Code refactoring failed:', error as Error);
      throw error;
    }
  }

  async generateTests(filePath: string, framework: string = 'jest'): Promise<GeneratedCode> {
    logger.info(`Generating tests for ${filePath}...`);
    
    try {
      // Read source code
      const sourceCode = await fs.readFile(filePath, 'utf8');
      
      // Create test generation request
      const request: AIGenerationRequest = {
        prompt: `Generate comprehensive tests for the following code using ${framework}:\n\n${sourceCode}`,
        type: 'test',
        context: `Framework: ${framework}, Source: ${filePath}`,
        filePath
      };
      
      return await this.generateCode(request);
      
    } catch (error) {
      logger.error('Test generation failed:', error as Error);
      throw error;
    }
  }

  async analyzeCode(filePath: string): Promise<AIAnalysisResult> {
    logger.info(`Analyzing code in ${filePath}...`);
    
    try {
      const code = await fs.readFile(filePath, 'utf8');
      
      const request: AIGenerationRequest = {
        prompt: `Analyze the following code and provide suggestions for improvement, identify potential issues, and assess complexity:\n\n${code}`,
        type: 'template',
        context: `Analysis request for: ${filePath}`
      };
      
      const result = await this.generateCode(request);
      
      // Parse analysis from AI response
      return this.parseAnalysisResult(result.code);
      
    } catch (error) {
      logger.error('Code analysis failed:', error as Error);
      throw error;
    }
  }

  async generateFromTemplate(templateName: string, variables: Record<string, any>): Promise<GeneratedCode> {
    logger.info(`Generating code from template: ${templateName}...`);
    
    try {
      // Load template
      const template = await this.loadTemplate(templateName);
      
      // Create generation request
      const request: AIGenerationRequest = {
        prompt: `Generate code using the following template and variables:\n\nTemplate: ${template}\n\nVariables: ${JSON.stringify(variables, null, 2)}`,
        type: 'template',
        context: `Template: ${templateName}`
      };
      
      return await this.generateCode(request);
      
    } catch (error) {
      logger.error('Template generation failed:', error as Error);
      throw error;
    }
  }

  private async loadAPIKeys(): Promise<void> {
    // Load from environment variables
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    
    if (openaiKey) this.apiKeys.set('openai', openaiKey);
    if (anthropicKey) this.apiKeys.set('anthropic', anthropicKey);
    
    // TODO: Load from config file if not in environment
  }

  private async validateConfiguration(): Promise<void> {
    if (this.apiKeys.size === 0) {
      throw new Error('No AI API keys configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variables.');
    }
  }

  private getDefaultModel(provider: AIProvider): string {
    const defaults = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-5-sonnet-latest'
    };
    return defaults[provider];
  }

  private async buildEnhancedPrompt(request: AIGenerationRequest): Promise<string> {
    let prompt = request.prompt;
    
    // Add context if available
    if (request.context) {
      prompt = `Context: ${request.context}\n\n${prompt}`;
    }
    
    // Add file-specific context
    if (request.filePath) {
      const fileExt = path.extname(request.filePath);
      prompt = `File type: ${fileExt}\nFile path: ${request.filePath}\n\n${prompt}`;
    }
    
    // Add AO-specific context
    prompt = `You are an expert AO smart contract developer. Generate clean, well-documented code that follows AO best practices.\n\n${prompt}`;
    
    return prompt;
  }

  private async callAIProvider(
    provider: AIProvider, 
    model: string, 
    prompt: string, 
    options?: Partial<GenerationOptions>
  ): Promise<string> {
    logger.debug(`Calling ${provider} with model ${model}...`);
    
    try {
      const apiKey = this.apiKeys.get(provider);
      if (!apiKey) {
        throw new Error(`No API key found for ${provider}`);
      }

      if (provider === 'openai') {
        const openai = new OpenAI({ apiKey });
        
        const response = await openai.chat.completions.create({
          model: model,
          messages: [
            { 
              role: "system", 
              content: this.getSystemPrompt(prompt, options) 
            },
            { 
              role: "user", 
              content: prompt 
            }
          ],
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 4000,
        });

        const generatedCode = response.choices[0]?.message?.content || '';
        if (!generatedCode) {
          throw new Error('No code was generated by OpenAI');
        }

        return generatedCode;

      } else if (provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey });
        
        const response = await anthropic.messages.create({
          model: model,
          max_tokens: options?.maxTokens || 4000,
          messages: [{
            role: "user",
            content: `${this.getSystemPrompt(prompt, options)}\n\n${prompt}`
          }],
          temperature: options?.temperature || 0.7,
        });

        const generatedCode = response.content[0].type === 'text' ? response.content[0].text : '';
        if (!generatedCode) {
          throw new Error('No code was generated by Anthropic');
        }

        return generatedCode;

      } else {
        throw new Error(`Unsupported AI provider: ${provider}`);
      }

    } catch (error) {
      logger.error(`Failed to call ${provider} API:`, error as Error);
      throw error;
    }
  }

  private getSystemPrompt(userPrompt: string, options?: Partial<GenerationOptions>): string {
    const basePrompt = `You are an expert AO smart contract developer. Generate clean, well-documented code that follows AO best practices.

Key requirements:
- Use Lua syntax for AO smart contracts
- Include comprehensive comments explaining the code
- Follow AO-specific patterns and conventions
- Ensure code is production-ready and secure
- Use proper error handling and validation
- Include examples of usage where appropriate

Generation type: ${options?.type || 'contract'}`;

    // Add type-specific instructions
    const typeInstructions = {
      contract: 'Focus on creating a complete, functional AO smart contract with proper state management and message handling.',
      module: 'Create a reusable Lua module with clear exports and documentation.',
      test: 'Generate comprehensive tests that cover all functionality, edge cases, and error conditions.',
      template: 'Create a template that can be easily customized with variables and parameters.',
      refactor: 'Improve the existing code while maintaining functionality, focusing on readability, performance, and best practices.'
    };

    const typeInstruction = typeInstructions[options?.type as keyof typeof typeInstructions] || '';
    
    return `${basePrompt}\n\n${typeInstruction}\n\nGenerate only the code, no explanations outside of comments.`;
  }

  private async validateGeneratedCode(code: string, type: string): Promise<ValidationResult> {
    // TODO: Implement code validation
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };
    
    // Basic validation
    if (!code || code.trim().length === 0) {
      result.valid = false;
      result.errors.push('Generated code is empty');
    }
    
    // Type-specific validation
    if (type === 'contract') {
      // Check for basic contract structure
      if (!code.includes('function') && !code.includes('local')) {
        result.warnings.push('Code may not follow contract patterns');
      }
    }
    
    return result;
  }

  private parseAnalysisResult(analysisText: string): AIAnalysisResult {
    // TODO: Implement parsing of AI analysis response
    return {
      suggestions: ['Consider adding more comments', 'Break down complex functions'],
      improvements: ['Use more descriptive variable names'],
      issues: [],
      complexity: 'medium'
    };
  }

  private async loadTemplate(templateName: string): Promise<string> {
    const templates: Record<string, string> = {
      'counter': `-- Counter contract template
-- A simple counter that can be incremented and decremented

local counter = 0

function increment()
  counter = counter + 1
  return counter
end

function decrement()
  counter = counter - 1
  return counter
end

function get()
  return counter
end

function reset()
  counter = 0
  return counter
end

return { 
  increment = increment, 
  decrement = decrement,
  get = get,
  reset = reset
}`,

      'token': `-- Token contract template
-- A basic token implementation with transfer functionality

local balances = {}
local totalSupply = 1000000
local owner = "{{OWNER_ADDRESS}}"

-- Initialize owner balance
balances[owner] = totalSupply

function transfer(to, amount)
  if not balances[msg.sender] or balances[msg.sender] < amount then
    error("Insufficient balance")
  end
  
  if amount <= 0 then
    error("Amount must be positive")
  end
  
  balances[msg.sender] = balances[msg.sender] - amount
  balances[to] = (balances[to] or 0) + amount
  
  return true
end

function balanceOf(address)
  return balances[address] or 0
end

function totalSupply()
  return totalSupply
end

return {
  transfer = transfer,
  balanceOf = balanceOf,
  totalSupply = totalSupply
}`,

      'nft': `-- NFT contract template
-- A non-fungible token implementation

local tokens = {}
local tokenCounter = 0
local owners = {}

function mint(metadata)
  tokenCounter = tokenCounter + 1
  local tokenId = tostring(tokenCounter)
  
  tokens[tokenId] = {
    id = tokenId,
    metadata = metadata,
    owner = msg.sender,
    createdAt = os.time()
  }
  
  owners[tokenId] = msg.sender
  
  return tokenId
end

function transfer(to, tokenId)
  if not tokens[tokenId] then
    error("Token does not exist")
  end
  
  if owners[tokenId] ~= msg.sender then
    error("Not the token owner")
  end
  
  owners[tokenId] = to
  tokens[tokenId].owner = to
  
  return true
end

function getToken(tokenId)
  return tokens[tokenId]
end

function ownerOf(tokenId)
  return owners[tokenId]
end

function totalSupply()
  return tokenCounter
end

return {
  mint = mint,
  transfer = transfer,
  getToken = getToken,
  ownerOf = ownerOf,
  totalSupply = totalSupply
}`,

      'dao': `-- DAO contract template
-- A decentralized autonomous organization implementation

local proposals = {}
local votes = {}
local proposalCounter = 0
local members = {}
local quorum = {{QUORUM}}

function addMember(address)
  if msg.sender == "{{DAO_OWNER}}" then
    members[address] = true
    return true
  end
  return false
end

function createProposal(description, action)
  if not members[msg.sender] then
    error("Only members can create proposals")
  end
  
  proposalCounter = proposalCounter + 1
  local proposalId = tostring(proposalCounter)
  
  proposals[proposalId] = {
    id = proposalId,
    description = description,
    action = action,
    creator = msg.sender,
    createdAt = os.time(),
    executed = false
  }
  
  return proposalId
end

function vote(proposalId, support)
  if not members[msg.sender] then
    error("Only members can vote")
  end
  
  if not proposals[proposalId] then
    error("Proposal does not exist")
  end
  
  votes[proposalId] = votes[proposalId] or {}
  votes[proposalId][msg.sender] = support
  
  return true
end

function executeProposal(proposalId)
  if not proposals[proposalId] then
    error("Proposal does not exist")
  end
  
  if proposals[proposalId].executed then
    error("Proposal already executed")
  end
  
  local yesVotes = 0
  local noVotes = 0
  
  for _, vote in pairs(votes[proposalId] or {}) do
    if vote then
      yesVotes = yesVotes + 1
    else
      noVotes = noVotes + 1
    end
  end
  
  if yesVotes + noVotes >= quorum and yesVotes > noVotes then
    proposals[proposalId].executed = true
    -- Execute the action here
    return true
  end
  
  return false
end

function getProposal(proposalId)
  return proposals[proposalId]
end

function isMember(address)
  return members[address] or false
end

return {
  addMember = addMember,
  createProposal = createProposal,
  vote = vote,
  executeProposal = executeProposal,
  getProposal = getProposal,
  isMember = isMember
}`,

      'marketplace': `-- Marketplace contract template
-- A decentralized marketplace for trading assets

local listings = {}
local listingCounter = 0
local fees = {{MARKETPLACE_FEE}}

function createListing(tokenId, price, tokenContract)
  if price <= 0 then
    error("Price must be positive")
  end
  
  listingCounter = listingCounter + 1
  local listingId = tostring(listingCounter)
  
  listings[listingId] = {
    id = listingId,
    tokenId = tokenId,
    price = price,
    tokenContract = tokenContract,
    seller = msg.sender,
    active = true,
    createdAt = os.time()
  }
  
  return listingId
end

function buyListing(listingId)
  local listing = listings[listingId]
  if not listing then
    error("Listing does not exist")
  end
  
  if not listing.active then
    error("Listing is not active")
  end
  
  if msg.value < listing.price then
    error("Insufficient payment")
  end
  
  -- Transfer token (this would need to be implemented based on token contract)
  -- Transfer payment to seller
  -- Take marketplace fee
  
  listing.active = false
  listing.buyer = msg.sender
  listing.soldAt = os.time()
  
  return true
end

function cancelListing(listingId)
  local listing = listings[listingId]
  if not listing then
    error("Listing does not exist")
  end
  
  if listing.seller ~= msg.sender then
    error("Only seller can cancel listing")
  end
  
  listing.active = false
  return true
end

function getListing(listingId)
  return listings[listingId]
end

function getActiveListings()
  local active = {}
  for id, listing in pairs(listings) do
    if listing.active then
      table.insert(active, listing)
    end
  end
  return active
end

return {
  createListing = createListing,
  buyListing = buyListing,
  cancelListing = cancelListing,
  getListing = getListing,
  getActiveListings = getActiveListings
}`,

      'oracle': `-- Oracle contract template
-- A price oracle for external data feeds

local prices = {}
local sources = {}
local updateThreshold = {{UPDATE_THRESHOLD}}

function addDataSource(name, address)
  if msg.sender == "{{ORACLE_OWNER}}" then
    sources[name] = address
    return true
  end
  return false
end

function updatePrice(asset, price, source)
  if not sources[source] then
    error("Invalid data source")
  end
  
  if price <= 0 then
    error("Price must be positive")
  end
  
  prices[asset] = {
    price = price,
    source = source,
    timestamp = os.time()
  }
  
  return true
end

function getPrice(asset)
  local priceData = prices[asset]
  if not priceData then
    error("Price not available")
  end
  
  -- Check if price is stale
  if os.time() - priceData.timestamp > updateThreshold then
    error("Price data is stale")
  end
  
  return priceData.price
end

function getPriceData(asset)
  return prices[asset]
end

function listAssets()
  local assets = {}
  for asset, _ in pairs(prices) do
    table.insert(assets, asset)
  end
  return assets
end

return {
  addDataSource = addDataSource,
  updatePrice = updatePrice,
  getPrice = getPrice,
  getPriceData = getPriceData,
  listAssets = listAssets
}`,

      'multisig': `-- Multisig wallet template
-- A multi-signature wallet implementation

local owners = {}
local requiredSignatures = {{REQUIRED_SIGNATURES}}
local pendingTransactions = {}
local transactionCounter = 0

function addOwner(address)
  if msg.sender == "{{MULTISIG_OWNER}}" then
    owners[address] = true
    return true
  end
  return false
end

function removeOwner(address)
  if msg.sender == "{{MULTISIG_OWNER}}" then
    owners[address] = nil
    return true
  end
  return false
end

function proposeTransaction(to, value, data)
  if not owners[msg.sender] then
    error("Only owners can propose transactions")
  end
  
  transactionCounter = transactionCounter + 1
  local txId = tostring(transactionCounter)
  
  pendingTransactions[txId] = {
    id = txId,
    to = to,
    value = value,
    data = data,
    proposer = msg.sender,
    signatures = {},
    executed = false,
    createdAt = os.time()
  }
  
  return txId
end

function signTransaction(txId)
  if not owners[msg.sender] then
    error("Only owners can sign transactions")
  end
  
  local tx = pendingTransactions[txId]
  if not tx then
    error("Transaction does not exist")
  end
  
  if tx.executed then
    error("Transaction already executed")
  end
  
  tx.signatures[msg.sender] = true
  
  return true
end

function executeTransaction(txId)
  local tx = pendingTransactions[txId]
  if not tx then
    error("Transaction does not exist")
  end
  
  if tx.executed then
    error("Transaction already executed")
  end
  
  local signatureCount = 0
  for _, _ in pairs(tx.signatures) do
    signatureCount = signatureCount + 1
  end
  
  if signatureCount < requiredSignatures then
    error("Insufficient signatures")
  end
  
  tx.executed = true
  -- Execute the transaction here
  
  return true
end

function getTransaction(txId)
  return pendingTransactions[txId]
end

function getPendingTransactions()
  local pending = {}
  for id, tx in pairs(pendingTransactions) do
    if not tx.executed then
      table.insert(pending, tx)
    end
  end
  return pending
end

return {
  addOwner = addOwner,
  removeOwner = removeOwner,
  proposeTransaction = proposeTransaction,
  signTransaction = signTransaction,
  executeTransaction = executeTransaction,
  getTransaction = getTransaction,
  getPendingTransactions = getPendingTransactions
}`,

      'lending': `-- Lending protocol template
-- A decentralized lending protocol

local loans = {}
local loanCounter = 0
local interestRate = {{INTEREST_RATE}}
local collateralRatio = {{COLLATERAL_RATIO}}

function createLoan(amount, collateral, duration)
  if amount <= 0 then
    error("Loan amount must be positive")
  end
  
  if collateral <= 0 then
    error("Collateral must be positive")
  end
  
  if duration <= 0 then
    error("Duration must be positive")
  end
  
  -- Check collateral ratio
  if collateral < amount * collateralRatio then
    error("Insufficient collateral")
  end
  
  loanCounter = loanCounter + 1
  local loanId = tostring(loanCounter)
  
  loans[loanId] = {
    id = loanId,
    borrower = msg.sender,
    amount = amount,
    collateral = collateral,
    duration = duration,
    interestRate = interestRate,
    createdAt = os.time(),
    dueDate = os.time() + duration,
    repaid = false,
    liquidated = false
  }
  
  return loanId
end

function repayLoan(loanId)
  local loan = loans[loanId]
  if not loan then
    error("Loan does not exist")
  end
  
  if loan.borrower ~= msg.sender then
    error("Only borrower can repay loan")
  end
  
  if loan.repaid then
    error("Loan already repaid")
  end
  
  if loan.liquidated then
    error("Loan was liquidated")
  end
  
  loan.repaid = true
  -- Return collateral to borrower
  
  return true
end

function liquidateLoan(loanId)
  local loan = loans[loanId]
  if not loan then
    error("Loan does not exist")
  end
  
  if loan.repaid or loan.liquidated then
    error("Loan cannot be liquidated")
  end
  
  if os.time() < loan.dueDate then
    error("Loan is not overdue")
  end
  
  loan.liquidated = true
  -- Transfer collateral to liquidator
  
  return true
end

function getLoan(loanId)
  return loans[loanId]
end

function getBorrowerLoans(borrower)
  local borrowerLoans = {}
  for id, loan in pairs(loans) do
    if loan.borrower == borrower then
      table.insert(borrowerLoans, loan)
    end
  end
  return borrowerLoans
end

return {
  createLoan = createLoan,
  repayLoan = repayLoan,
  liquidateLoan = liquidateLoan,
  getLoan = getLoan,
  getBorrowerLoans = getBorrowerLoans
}`
    };
    
    return templates[templateName] || '-- Default template\n-- No specific template found for: ' + templateName;
  }

  private async processTemplateVariables(template: string, variables: Record<string, any>): Promise<string> {
    let processedTemplate = template;
    
    // Replace template variables
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key.toUpperCase()}}}`;
      processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), String(value));
    }
    
    // Set default values for common variables
    const defaults = {
      'OWNER_ADDRESS': variables.ownerAddress || 'owner-address-here',
      'QUORUM': variables.quorum || 3,
      'DAO_OWNER': variables.daoOwner || 'dao-owner-here',
      'MARKETPLACE_FEE': variables.marketplaceFee || 0.025,
      'UPDATE_THRESHOLD': variables.updateThreshold || 3600,
      'ORACLE_OWNER': variables.oracleOwner || 'oracle-owner-here',
      'REQUIRED_SIGNATURES': variables.requiredSignatures || 2,
      'MULTISIG_OWNER': variables.multisigOwner || 'multisig-owner-here',
      'INTEREST_RATE': variables.interestRate || 0.05,
      'COLLATERAL_RATIO': variables.collateralRatio || 1.5
    };
    
    for (const [key, value] of Object.entries(defaults)) {
      const placeholder = `{{${key}}}`;
      if (processedTemplate.includes(placeholder)) {
        processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), String(value));
      }
    }
    
    return processedTemplate;
  }

  getSupportedProviders(): AIProvider[] {
    return ['openai', 'anthropic'];
  }

  getSupportedModels(provider: AIProvider): string[] {
    const models = {
      openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
      anthropic: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest']
    };
    return models[provider] || [];
  }

  // Advanced Features

  async optimizeCode(filePath: string, optimizationType: 'performance' | 'security' | 'readability' = 'performance'): Promise<GeneratedCode> {
    logger.info(`Optimizing code in ${filePath} for ${optimizationType}...`);
    
    try {
      const code = await fs.readFile(filePath, 'utf8');
      
      const optimizationPrompts = {
        performance: 'Optimize this code for maximum performance, focusing on algorithm efficiency, memory usage, and execution speed:',
        security: 'Analyze and improve this code for security, focusing on input validation, access control, and vulnerability prevention:',
        readability: 'Refactor this code to improve readability, maintainability, and code organization:'
      };
      
      const request: AIGenerationRequest = {
        prompt: `${optimizationPrompts[optimizationType]}\n\n${code}`,
        type: 'refactor',
        context: `Optimization type: ${optimizationType}, File: ${filePath}`,
        filePath,
        options: {
          temperature: 0.3 // Lower temperature for more focused optimization
        }
      };
      
      return await this.generateCode(request);
      
    } catch (error) {
      logger.error('Code optimization failed:', error as Error);
      throw error;
    }
  }

  async generateDocumentation(filePath: string, format: 'markdown' | 'html' | 'json' = 'markdown'): Promise<GeneratedCode> {
    logger.info(`Generating ${format} documentation for ${filePath}...`);
    
    try {
      const code = await fs.readFile(filePath, 'utf8');
      
      const request: AIGenerationRequest = {
        prompt: `Generate comprehensive ${format} documentation for this code, including:\n- Function descriptions and parameters\n- Usage examples\n- API reference\n- Architecture overview\n\nCode:\n${code}`,
        type: 'template',
        context: `Documentation format: ${format}, File: ${filePath}`,
        filePath,
        options: {
          temperature: 0.5
        }
      };
      
      return await this.generateCode(request);
      
    } catch (error) {
      logger.error('Documentation generation failed:', error as Error);
      throw error;
    }
  }

  async performSecurityAudit(filePath: string): Promise<AIAnalysisResult> {
    logger.info(`Performing security audit on ${filePath}...`);
    
    try {
      const code = await fs.readFile(filePath, 'utf8');
      
      const request: AIGenerationRequest = {
        prompt: `Perform a comprehensive security audit of this code. Identify:\n- Security vulnerabilities\n- Access control issues\n- Input validation problems\n- Potential attack vectors\n- Security best practices violations\n\nCode:\n${code}`,
        type: 'template',
        context: `Security audit for: ${filePath}`,
        filePath,
        options: {
          temperature: 0.2 // Very low temperature for precise analysis
        }
      };
      
      const result = await this.generateCode(request);
      
      // Parse security-specific analysis
      return this.parseSecurityAuditResult(result.code);
      
    } catch (error) {
      logger.error('Security audit failed:', error as Error);
      throw error;
    }
  }

  async batchProcess(files: string[], operation: 'analyze' | 'optimize' | 'document' | 'test'): Promise<Map<string, any>> {
    logger.info(`Starting batch ${operation} for ${files.length} files...`);
    
    const results = new Map<string, any>();
    
    try {
      for (const file of files) {
        logger.debug(`Processing ${file}...`);
        
        try {
          let result: any;
          
          switch (operation) {
            case 'analyze':
              result = await this.analyzeCode(file);
              break;
            case 'optimize':
              result = await this.optimizeCode(file);
              break;
            case 'document':
              result = await this.generateDocumentation(file);
              break;
            case 'test':
              result = await this.generateTests(file);
              break;
          }
          
          results.set(file, { success: true, result });
          
        } catch (error) {
          logger.warn(`Failed to process ${file}:`, error as Error);
          results.set(file, { success: false, error: (error as Error).message });
        }
      }
      
      logger.success(`Batch ${operation} completed. ${results.size} files processed.`);
      return results;
      
    } catch (error) {
      logger.error('Batch processing failed:', error as Error);
      throw error;
    }
  }

  async generateMigrationScript(sourcePath: string, targetFramework: string): Promise<GeneratedCode> {
    logger.info(`Generating migration script from ${sourcePath} to ${targetFramework}...`);
    
    try {
      const code = await fs.readFile(sourcePath, 'utf8');
      
      const request: AIGenerationRequest = {
        prompt: `Generate a migration script to convert this code to ${targetFramework}. Include:\n- Step-by-step migration process\n- Code transformations\n- Configuration changes\n- Testing instructions\n\nSource code:\n${code}`,
        type: 'template',
        context: `Migration to: ${targetFramework}, Source: ${sourcePath}`,
        filePath: sourcePath,
        options: {
          temperature: 0.4
        }
      };
      
      return await this.generateCode(request);
      
    } catch (error) {
      logger.error('Migration script generation failed:', error as Error);
      throw error;
    }
  }

  async generateIntegrationTests(contractPath: string, integrationType: 'api' | 'database' | 'external' = 'api'): Promise<GeneratedCode> {
    logger.info(`Generating ${integrationType} integration tests for ${contractPath}...`);
    
    try {
      const code = await fs.readFile(contractPath, 'utf8');
      
      const request: AIGenerationRequest = {
        prompt: `Generate comprehensive ${integrationType} integration tests for this contract. Include:\n- Setup and teardown procedures\n- Happy path scenarios\n- Error handling cases\n- Performance tests\n- Security tests\n\nContract code:\n${code}`,
        type: 'test',
        context: `Integration type: ${integrationType}, Contract: ${contractPath}`,
        filePath: contractPath,
        options: {
          temperature: 0.3
        }
      };
      
      return await this.generateCode(request);
      
    } catch (error) {
      logger.error('Integration test generation failed:', error as Error);
      throw error;
    }
  }

  private parseSecurityAuditResult(auditText: string): AIAnalysisResult {
    // Enhanced parsing for security audit results
    const lines = auditText.split('\n');
    const suggestions: string[] = [];
    const improvements: string[] = [];
    const issues: string[] = [];
    
    let currentSection = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.toLowerCase().includes('vulnerability') || trimmed.toLowerCase().includes('security issue')) {
        issues.push(trimmed);
      } else if (trimmed.toLowerCase().includes('suggestion') || trimmed.toLowerCase().includes('recommendation')) {
        suggestions.push(trimmed);
      } else if (trimmed.toLowerCase().includes('improvement') || trimmed.toLowerCase().includes('enhancement')) {
        improvements.push(trimmed);
      }
    }
    
    // Determine complexity based on number of issues
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (issues.length > 5) complexity = 'high';
    else if (issues.length > 2) complexity = 'medium';
    
    return {
      suggestions,
      improvements,
      issues,
      complexity
    };
  }
} 