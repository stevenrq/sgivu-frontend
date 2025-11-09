import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { PaginatedResponse } from '../../../../shared/models/paginated-response';
import { Params, RouterLink } from '@angular/router';

@Component({
  selector: 'app-pager',
  imports: [RouterLink],
  templateUrl: './pager.component.html',
  styleUrls: ['./pager.component.css'],
})
export class PagerComponent<T = unknown> implements OnChanges {
  @Input({ required: true })
  pager!: PaginatedResponse<T>;

  @Input({ required: true })
  url!: string;

  @Input()
  queryParams: Params | null = null;

  pages: number[] = [];

  get firstPageIndex(): number {
    return 0;
  }

  get lastPageIndex(): number {
    return this.pager ? this.pager.totalPages - 1 : 0;
  }

  public generatePages(
    currentPage: number,
    totalPages: number,
    pagesToShow = 5,
  ): number[] {
    if (pagesToShow % 2 === 0) {
      pagesToShow++;
    }

    const pages: number[] = [];

    if (totalPages <= pagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    const halfPagesToShow = Math.floor(pagesToShow / 2);
    let startPage: number;
    let endPage: number;
    const currentPageOneBased = currentPage + 1;

    if (currentPageOneBased <= halfPagesToShow) {
      startPage = 1;
      endPage = pagesToShow;
    } else if (currentPageOneBased + halfPagesToShow >= totalPages) {
      startPage = totalPages - pagesToShow + 1;
      endPage = totalPages;
    } else {
      startPage = currentPageOneBased - halfPagesToShow;
      endPage = currentPageOneBased + halfPagesToShow;
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pager'] && this.pager) {
      this.pages = this.generatePages(this.pager.number, this.pager.totalPages);
    }
  }
}
