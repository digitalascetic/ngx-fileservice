import {Subject} from 'rxjs';
import { ManagedFile } from './managed.file';
import { FileEvent } from './file.event';

/**
 * Created by martino on 12/07/17.
 */

export enum FileValidators {
    SIZE_VALIDATOR,
    DIMENSIONS_VALIDATOR,
    LANDSCAPE_VALIDATOR
}

export interface ManagedFileValidator {

    // Maximum file size allowed
    maxSizeAllowed: number;

    mimeTypesAllowed: string[];

    minWidth?: number;

    minHeight?: number;

    validators: FileValidators[];

    /**
     * Validate a ManagedFile returning the error message in case of
     *
     * @param file
     * @param fileEventSubject
     */
    validate(file: ManagedFile, fileEventSubject: Subject<FileEvent>): boolean;

}
