import fs from 'fs-extra';

import { ProjectManager } from '../src/project-manager';
import { execAsync } from '../src/utils';
import ora from 'ora';
import inquirer from 'inquirer';
import { CliOptions } from '../src/types';

// Mock external dependencies
jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('ora');
jest.mock('inquirer');
jest.mock('../src/utils', () => ({
    execAsync: jest.fn()
}));

describe('ProjectManager', () => {
    let projectManager: ProjectManager;
    const mockExecAsync = execAsync as jest.Mock;

    beforeEach(() => {
        projectManager = new ProjectManager();
        jest.clearAllMocks();
    });

    describe('cloneTemplate', () => {
        it('should clone template and remove .git directory successfully', async () => {
            const mockStart = jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() });
            (ora as jest.MockedFunction<typeof ora>).mockReturnValue(mockStart as any);
            (mockExecAsync as jest.MockedFunction<any>).mockResolvedValueOnce({});
            
            const template = 'https://github.com/test/template.git';
            const targetPath = '/path/to/project';

            await projectManager.cloneTemplate(template, targetPath);

            expect(mockExecAsync).toHaveBeenCalledWith(`git clone ${template} ${targetPath}`);
            expect(fs.remove).toHaveBeenCalledWith(expect.stringContaining('.git'));
        });

        it('should throw error if clone fails', async () => {
            const mockStart = jest.fn().mockReturnValue({ 
                succeed: jest.fn(), 
                fail: jest.fn() 
            });
            (ora as jest.MockedFunction<typeof ora>).mockReturnValue(mockStart as any);
            (mockExecAsync as jest.MockedFunction<any>).mockRejectedValueOnce(new Error('Clone failed'));
            
            const template = 'https://github.com/test/template.git';
            const targetPath = '/path/to/project';

            await expect(projectManager.cloneTemplate(template, targetPath)).rejects.toThrow('Clone failed');
        });
    });

    describe('initializeGit', () => {
        it('should initialize git repository successfully', async () => {
            const mockStart = jest.fn().mockReturnValue({ 
                succeed: jest.fn(), 
                fail: jest.fn() 
            });
            (ora as jest.MockedFunction<typeof ora>).mockReturnValue(mockStart as any);
            (mockExecAsync as jest.MockedFunction<any>)
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({});
            
            const targetPath = '/path/to/project';

            await projectManager.initializeGit(targetPath);

            expect(mockExecAsync).toHaveBeenCalledWith('git init', { cwd: targetPath });
            expect(mockExecAsync).toHaveBeenCalledWith('git add .', { cwd: targetPath });
            expect(mockExecAsync).toHaveBeenCalledWith('git commit -m "Initial commit from AO CLI"', { cwd: targetPath });
        });

        it('should throw error if git initialization fails', async () => {
            const mockStart = jest.fn().mockReturnValue({ 
                succeed: jest.fn(), 
                fail: jest.fn() 
            });
            (ora as jest.MockedFunction<typeof ora>).mockReturnValue(mockStart as any);
            (mockExecAsync as jest.MockedFunction<any>).mockRejectedValueOnce(new Error('Git init failed'));
            
            const targetPath = '/path/to/project';

            await expect(projectManager.initializeGit(targetPath)).rejects.toThrow('Git init failed');
        });
    });

    describe('installDependencies', () => {
        it('should install dependencies successfully', async () => {
            const mockStart = jest.fn().mockReturnValue({ 
                succeed: jest.fn(), 
                fail: jest.fn() 
            });
            (ora as jest.MockedFunction<typeof ora>).mockReturnValue(mockStart as any);
            (mockExecAsync as jest.MockedFunction<any>).mockResolvedValueOnce({});
            
            const targetPath = '/path/to/project';
            const packageManager = 'npm';

            await projectManager.installDependencies(targetPath, packageManager);

            expect(mockExecAsync).toHaveBeenCalledWith(`${packageManager} install`, { cwd: targetPath });
        });

        it('should throw error if dependency installation fails', async () => {
            const mockStart = jest.fn().mockReturnValue({ 
                succeed: jest.fn(), 
                fail: jest.fn() 
            });
            (ora as jest.MockedFunction<typeof ora>).mockReturnValue(mockStart as any);
            (mockExecAsync as jest.MockedFunction<any>).mockRejectedValueOnce(new Error('Install failed'));
            
            const targetPath = '/path/to/project';
            const packageManager = 'npm';

            await expect(projectManager.installDependencies(targetPath, packageManager)).rejects.toThrow('Install failed');
        });
    });

    describe('validateDirectory', () => {
        it('should return true for empty directory', async () => {
            (fs.stat as jest.MockedFunction<any>).mockResolvedValueOnce({ isDirectory: () => true });
            (fs.readdir as jest.MockedFunction<any>).mockResolvedValueOnce([]);
            
            const result = await projectManager.validateDirectory('/path/to/empty/dir');
            
            expect(result).toBe(true);
        });

        it('should return false for non-empty or non-existent directory', async () => {
            (fs.stat as jest.MockedFunction<any>).mockResolvedValueOnce({ isDirectory: () => true });
            (fs.readdir as jest.MockedFunction<any>).mockResolvedValueOnce(['file1']);
            
            const result = await projectManager.validateDirectory('/path/to/non-empty/dir');
            
            expect(result).toBe(false);
        });

        it('should return false if directory cannot be accessed', async () => {
            (fs.stat as jest.MockedFunction<any>).mockRejectedValueOnce(new Error('Access denied'));
            
            const result = await projectManager.validateDirectory('/path/to/inaccessible/dir');
            
            expect(result).toBe(false);
        });
    });

    describe('promptForMissingOptions', () => {
        it('should prompt for missing options', async () => {
            const mockPrompt = jest.fn().mockResolvedValueOnce({
                framework: 'nextjs',
                name: 'test-project',
                packageManager: 'npm',
                aosProcess: true,
                processName: 'custom-process'
            });
            (inquirer.prompt as jest.MockedFunction<any>).mockImplementation(mockPrompt);

            const options = {};
            const result = await projectManager.promptForMissingOptions(options);

            expect(mockPrompt).toHaveBeenCalledWith(expect.any(Array));
            expect(result).toEqual({
                framework: 'nextjs',
                name: 'test-project',
                packageManager: 'npm',
                aosProcess: true,
                processName: 'custom-process'
            });
        });

        it('should not prompt for options already provided', async () => {
            const mockPrompt = jest.fn().mockResolvedValueOnce({});
            (inquirer.prompt as jest.MockedFunction<any>).mockImplementation(mockPrompt);

            const options = {
                framework: 'nextjs',
                name: 'test-project',
                packageManager: 'npm'
            };
            const result = await projectManager.promptForMissingOptions(options as CliOptions);

            expect(mockPrompt).toHaveBeenCalledWith([]);
            expect(result).toEqual(options);
        });
    });
});