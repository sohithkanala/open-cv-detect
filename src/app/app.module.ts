import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NgOpenCVService } from './lib/ng-open-cv.service';
import { OpenCVOptions } from './lib/ng-open-cv.models';
import { NgOpenCVModule } from './lib/ng-open-cv.module';
import { ImageCropperModule } from 'ngx-image-cropper';

const openCVConfig: OpenCVOptions = {
  scriptUrl: `assets/opencv/opencv.js`,
  wasmBinaryFile: 'wasm/opencv_js.wasm',
  usingWasm: true,
};
@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    NgOpenCVModule.forRoot(openCVConfig),
    ImageCropperModule
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
