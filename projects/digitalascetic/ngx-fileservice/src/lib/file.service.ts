import { ManagedFile } from './managed.file';
import { Observable } from 'rxjs';
import { FileEvent } from './file.event';

export interface FileService {

    uploadFile(file: ManagedFile, path: string, options: any): Observable<FileEvent>;

    deleteFile(file: ManagedFile, options: any): Observable<FileEvent>;

}