import * as ProjectModule from '../src/project';
import * as ConfigModule from '../src/config';
import * as ProcessManagerModule from '../src/process-manager';
import * as SchedulerModule from '../src/scheduler';

describe('Project Initialization Modules', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should export core modules', () => {
    expect(ProjectModule).toBeDefined();
    expect(ConfigModule).toBeDefined();
    expect(ProcessManagerModule).toBeDefined();
    expect(SchedulerModule).toBeDefined();
  });

  describe('Module Exports', () => {
    it('should have expected exports from project module', () => {
      const expectedProjectExports = [
        'createProject',
        'validateDirectory'
      ];

      expectedProjectExports.forEach(exportName => {
        expect(ProjectModule[exportName]).toBeDefined();
      });
    });

    it('should have expected exports from config module', () => {
      const expectedConfigExports = [
        'loadConfig',
        'saveConfig'
      ];

      expectedConfigExports.forEach(exportName => {
        expect(ConfigModule[exportName]).toBeDefined();
      });
    });

    it('should have expected exports from process manager', () => {
      const expectedProcessManagerExports = [
        'AOSProcessManager'
      ];

      expectedProcessManagerExports.forEach(exportName => {
        expect(ProcessManagerModule[exportName]).toBeDefined();
      });
    });

    it('should have expected exports from scheduler', () => {
      const expectedSchedulerExports = [
        'Schedule'
      ];

      expectedSchedulerExports.forEach(exportName => {
        expect(SchedulerModule[exportName]).toBeDefined();
      });
    });
  });
});