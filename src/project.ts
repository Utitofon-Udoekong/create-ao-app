import { execAsync } from './utils';
import ora from 'ora';
import chalk from 'chalk';
import { AOSProcessManager } from './process-manager';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { loadConfig, saveConfig } from './config';
import { Config, CreateProjectOptions } from './types';
import { ProjectManager } from './project-manager';

const TEMPLATES = {
    nextjs: 'https://github.com/Utitofon-Udoekong/next-ao-starter-kit.git',
    nuxtjs: 'https://github.com/Utitofon-Udoekong/nuxt-ao-starter-kit.git'
};

const projectManager = new ProjectManager();
const processManager = new AOSProcessManager();


export async function createProject(
    name: string,
    options: CreateProjectOptions
): Promise<void> {


    try {
        const framework = options.framework || 'nuxtjs';
        const packageManager = options.packageManager || 'npm';

        // Determine target directory
        let projectPath = options.path || options.name || 'ao-project';
        projectPath = path.resolve(process.cwd(), projectPath);

        // Check if directory exists and is empty
        const exists = await projectManager.validateDirectory(projectPath);
        if (!exists) {
            await fs.ensureDir(projectPath);
        }

        // Clone template
        const templateUrl = TEMPLATES[framework as keyof typeof TEMPLATES];
        await projectManager.cloneTemplate(templateUrl, projectPath);

        // Initialize new git repository
        await projectManager.initializeGit(projectPath);

        // Install dependencies
        await projectManager.installDependencies(projectPath, packageManager);


        const nuxtAODir = 'ao';
        const nextAODir = 'src/ao';
        const processDir = framework == 'nuxtjs' ? nuxtAODir : nextAODir

        // Create AO process directory
        const processName = options.processName || `${path.basename(projectPath)}-process`;
        const processPath = path.join(projectPath, processDir);
        await fs.ensureDir(processPath);

        // Create default configuration
        const defaultConfig: Config = {
            luaFiles: {
                [processDir]: {
                    processName: `${name}-process`,
                    scheduler: {
                        interval: 1000,
                        tick: 'tick',
                        patterns: ['*']
                    }
                }
            },
            packageManager,
            autoStart: true,
            ports: {
                dev: 4000
            }
        };

        // Load custom config if provided
        const config = options.config
            ? await loadConfig(options.config, defaultConfig)
            : defaultConfig;

        // Save configuration
        await saveConfig(projectPath, config);

        // Start AO process if enabled
        if (options.aosProcess !== false) {
            await AOSProcessManager.startProcess(
                projectPath,
                processName,
                `${processDir}/chatroom.lua`,
                config
            );

            // Monitor process if requested
            if (options.monitor) {
                await AOSProcessManager.monitorProcess(
                    config.luaFiles[`${processDir}/chatroom.lua`].processName,
                    projectPath
                );
            }

            // Evaluate process if requested
            if (options.eval) {
                await AOSProcessManager.evaluateProcess(
                    config.luaFiles[`${processDir}/chatroom.lua`].processName,
                    options.eval,
                    projectPath
                );
            }
        }

        console.log(`✨ Project ${name} created successfully!`);
    } catch (error) {
        console.error('Error creating project:', error);
        throw error;
    }
}


export async function startProject(projectPath: string) {
    try {
        // Write the code to Start project with choosen package manager alongside an AO process   
        const config = await loadConfig(projectPath, defaultConfig);
        const processName = config.luaFiles[`${processDir}/chatroom.lua`].processName;
        await AOSProcessManager.startProcess(projectPath, processName, `${processDir}/chatroom.lua`, config);   
    } catch (error) {
        console.error('Error starting project:', error);
        throw error;
    }
}