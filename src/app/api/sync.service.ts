import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, Subscription } from 'rxjs';
import { forEach, omit } from 'lodash';
import { List } from 'immutable';

import { ICollectionService } from '../../lib/collection.service';
import { UsersService } from '../users/users.service';
import { NotesService } from '../notes/notes.service';

type TEntry = {
  id: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  collectionSubscriptions: Array<Subscription> = [];

  constructor(
    private usersService: UsersService,
    private notesService: NotesService
  ) {
    this.subscribeToCollectionService(usersService);
    this.subscribeToCollectionService(notesService);
  }

  private subscribeToCollectionService(collectionService: ICollectionService): boolean {
    console.debug('Subscribing to collection', collectionService.collectionName, '...');
    const collectionSubscription: Subscription = collectionService.entriesPersisted.subscribe(async (entries: List<any>): Promise<boolean> => {
      const collectionName: string = collectionService.collectionName;
      const db: any = collectionService.db;

      if(entries.size === 0) {
        console.debug('Nothing to persist to local database.');
        return true;
      }

      // TODO: Run through db, compare with entries and see, which db entries were deleted in entires, hence require deletion.
      try {
        console.debug('Persisting changes to local database ...');
        const entriesObjects: Array<TEntry> = entries.toJS();
        console.debug('Got original data:');
        console.debug(entriesObjects);
        const rows: Array<Object> = this.rowsFromEntries(entriesObjects);
        console.debug('Transformed original data:');
        console.debug(rows);
        const dbret = await db.bulkDocs(rows);
        console.debug(dbret);

        const newEntries: List<any> = entries.map((entry: any) => {
          const entryId = entry.id;
          const dbretEntry = dbret.find((retEntry) => (retEntry.ok === true && retEntry.id === entryId));
          return entry.set('_rev', dbretEntry.rev);
        });

        collectionService.bulkChange(newEntries);
      } catch(err) {
        console.error('Could not persist changes to local database:');
        console.error(err);
      }

      return true;
    });

    this.collectionSubscriptions.push(collectionSubscription);
    return true;
  }

  private unsubscribeCollectionSubscriptions(): boolean {
    console.debug('Unsubscribing from all current subscriptions ...');
    forEach(this.collectionSubscriptions, (subscription: Subscription): boolean => {
      subscription.unsubscribe();
      return true;
    });

    return true;
  }

  private rowFromEntry(entry: TEntry): Object {
    const row = omit(entry, ['id']);
    row._id = entry.id;

    return row;
  }

  private rowsFromEntries(entries: Array<TEntry>): Array<Object> {
    return entries.map((entry: TEntry) => {
      return this.rowFromEntry(entry);
    });
  }

}