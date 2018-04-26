// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import * as assert from "assert";
import { HttpClient } from "../../lib/httpClient";
import { HttpMethod } from "../../lib/httpMethod";
import { HttpPipeline, createDefaultHttpPipeline } from "../../lib/httpPipeline";
import { HttpRequest } from "../../lib/httpRequest";
import { HttpResponse } from "../../lib/httpResponse";
import { InMemoryHttpResponse } from "../../lib/inMemoryHttpResponse";
import { userAgentPolicy } from "../../lib/policies/userAgentPolicy";
import { BaseRequestPolicy } from "../../lib/requestPolicy";
import { FakeHttpClient } from "../shared/fakeHttpClient";
import { baseURL } from "../testUtils";

describe("HttpPipeline", () => {
  it("should send requests when no request policies are assigned", async () => {
    const httpClient: HttpClient = new FakeHttpClient((request: HttpRequest) => {
      return Promise.resolve(new InMemoryHttpResponse(request, 200, {}, "hello"));
    });

    const httpPipeline = new HttpPipeline([], { httpClient: httpClient });

    const httpRequest = new HttpRequest({ method: HttpMethod.GET, url: `${baseURL}/example-index.html` });
    const response: HttpResponse = await httpPipeline.send(httpRequest);
    assert.deepStrictEqual(response.request, httpRequest);
    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.headers.toJson(), {});

    const responseBodyAsText: string | undefined = await response.textBody();
    assert.strictEqual("hello", responseBodyAsText);
  });

  it("should send requests when request-modifying request policies are assigned", async () => {
    const httpClient: HttpClient = new FakeHttpClient((request: HttpRequest) => {
      assert.deepStrictEqual(request.headers.toJson(), { "User-Agent": "my user agent string" });
      return Promise.resolve(new InMemoryHttpResponse(request, 200, {}, "hello2"));
    });

    const httpPipeline = new HttpPipeline(
      [userAgentPolicy("my user agent string")],
      { httpClient: httpClient });

    const httpRequest = new HttpRequest({ method: HttpMethod.GET, url: `${baseURL}/example-index.html` });
    const response: HttpResponse = await httpPipeline.send(httpRequest);
    assert.deepStrictEqual(response.request, httpRequest);
    assert.deepStrictEqual(response.request.headers.toJson(), { "User-Agent": "my user agent string" });
    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.headers.toJson(), {});
    const responseBodyAsText: string | undefined = await response.textBody();
    assert.strictEqual("hello2", responseBodyAsText);
  });

  it("should send requests when response-modifying request policies are assigned", async () => {
    const httpClient: HttpClient = new FakeHttpClient((request: HttpRequest) => {
      assert.deepStrictEqual(request.headers.toJson(), {});
      return Promise.resolve(new InMemoryHttpResponse(request, 200, {}, "hello3"));
    });

    class ResponseModifyingRequestPolicy extends BaseRequestPolicy {
      public async send(request: HttpRequest): Promise<HttpResponse> {
        const response: HttpResponse = await this._nextPolicy.send(request);
        response.headers.set("My-Header", "My-Value");
        return response;
      }
    }

    const httpPipeline = new HttpPipeline(
      [(nextPolicy, options) => new ResponseModifyingRequestPolicy(nextPolicy, options)],
      { httpClient: httpClient });

    const httpRequest = new HttpRequest({ method: HttpMethod.GET, url: `${baseURL}/example-index.html` });
    const response: HttpResponse = await httpPipeline.send(httpRequest);
    assert.deepStrictEqual(response.request, httpRequest);
    assert.deepStrictEqual(response.request.headers.toJson(), {});
    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.headers.toJson(), { "My-Header": "My-Value" });
    const responseBodyAsText: string | undefined = await response.textBody();
    assert.strictEqual("hello3", responseBodyAsText);
  });

  it("should send requests when using the default HTTP pipeline", async () => {
    const httpPipeline: HttpPipeline = createDefaultHttpPipeline();

    const httpRequest = new HttpRequest({ method: HttpMethod.GET, url: `${baseURL}/httpbin-index.html` });

    const httpResponse: HttpResponse = await httpPipeline.send(httpRequest);
    assert(httpResponse);

    assert.strictEqual(httpResponse.statusCode, 200);

    assert(httpResponse.headers);
    assert.strictEqual(httpResponse.headers.get("content-length"), "13129");
    assert.strictEqual(httpResponse.headers.get("content-type"), "text/html; charset=UTF-8");
    assert(httpResponse.headers.get("date"));

    const textBody: string = await httpResponse.textBody() as string;
    assert(textBody);
    assert.notStrictEqual(textBody.indexOf(`<html>`), -1);
    assert.notStrictEqual(textBody.indexOf(`httpbin.org`), -1);

    assert.deepEqual(httpResponse.request, httpRequest);
  });
});