/*
 * Public API Surface of ngx-fileservice
 */

export {FileServiceModule} from './lib/file-service.module';
export {ManagedFile, ManagedFileStatus} from './lib/managed-file';
export {FileService} from './lib/file.service';
export {S3FileService} from './lib/s3.file.service';
export {FileEvent, FileEventType} from './lib/file-event';
export {MultiFileEvent, MultiFileEventType} from './lib/multi-file-event';
