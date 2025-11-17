// Verify scheduler integration path is unaffected: it should call performBackup
// when auto-backup is enabled and lastBackupTime is null or old.

describe('BackupScheduler', () => {
  it('should trigger performBackup when started and auto-backup is enabled', async () => {
    const { BackupService } = await import('@/lib/backup');
    const { BackupScheduler } = await import('@/lib/backup-scheduler');

    const service = BackupService.getInstance();
    const getStatusSpy = jest
      .spyOn(service, 'getBackupStatus')
      .mockResolvedValue({
        lastBackupTime: null,
        lastBackupSuccess: false,
        backupCount: 0,
        isAutoBackupEnabled: true
      });
    const performBackupSpy = jest
      .spyOn(service, 'performBackup')
      .mockResolvedValue(true);

    const scheduler = BackupScheduler.getInstance();
    scheduler.start();

    // Allow the immediate run in start() to finish
    await new Promise(res => setTimeout(res, 0));

    scheduler.stop();

    expect(getStatusSpy).toHaveBeenCalled();
    expect(performBackupSpy).toHaveBeenCalled();
  });
});


